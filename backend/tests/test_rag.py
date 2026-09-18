from unittest.mock import patch


def test_rag_query_unconfigured_api_key(client, employee_headers):
    # When GEMINI_API_KEY is not set or mock behavior handles unconfigured state
    res = client.post(
        "/api/rag/query",
        json={"question": "What is the maintenance routine?", "top_k": 3},
        headers=employee_headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert "answer" in data
    assert "sources" in data


def test_rag_query_with_mocked_answer(client, employee_headers):
    mock_answer = "Pump P-101 requires ISO VG 46 oil every 500 operating hours [Source 1]."
    mock_sources = [
        {
            "document_id": 1,
            "document_name": "Pump_Manual.pdf",
            "page": 12,
            "excerpt": "Pump P-101 requires ISO VG 46 oil every 500 operating hours...",
            "score": 0.92,
        }
    ]

    with patch("app.routers.rag.answer_question", return_value=(mock_answer, mock_sources)):
        res = client.post(
            "/api/rag/query",
            json={"question": "What oil does Pump P-101 take?", "top_k": 5},
            headers=employee_headers,
        )
        assert res.status_code == 200
        data = res.json()
        assert data["answer"] == mock_answer
        assert len(data["sources"]) == 1
        assert data["sources"][0]["score"] == 0.92
