import io
from unittest.mock import patch


def test_upload_document_success(client, admin_headers, tmp_path):
    with patch("app.routers.documents.process_document_background"):
        file_content = b"Pump P-101 requires monthly lubrication with ISO VG 46 oil."
        files = {"file": ("pump_manual.txt", io.BytesIO(file_content), "text/plain")}
        res = client.post("/api/documents", files=files, headers=admin_headers)

        assert res.status_code == 202
        data = res.json()
        assert data["original_name"] == "pump_manual.txt"
        assert data["status"] == "processing"
        assert data["progress"] == 5
        assert data["size_bytes"] == len(file_content)
        assert data["file_hash"] is not None


def test_upload_duplicate_document_rejection(client, admin_headers):
    with patch("app.routers.documents.process_document_background"):
        file_content = b"Duplicate file contents test standard operating procedure."
        files1 = {"file": ("sop.txt", io.BytesIO(file_content), "text/plain")}
        res1 = client.post("/api/documents", files=files1, headers=admin_headers)
        assert res1.status_code == 202

        # Try uploading identical file content
        files2 = {"file": ("sop_copy.txt", io.BytesIO(file_content), "text/plain")}
        res2 = client.post("/api/documents", files=files2, headers=admin_headers)
        assert res2.status_code == 409
        assert "Duplicate document" in res2.json()["detail"] or "currently being processed" in res2.json()["detail"]


def test_upload_unsupported_file_type(client, admin_headers):
    files = {"file": ("malicious.exe", io.BytesIO(b"binary data"), "application/octet-stream")}
    res = client.post("/api/documents", files=files, headers=admin_headers)
    assert res.status_code == 415
    assert "Unsupported file type" in res.json()["detail"]


def test_upload_empty_file(client, admin_headers):
    files = {"file": ("empty.txt", io.BytesIO(b""), "text/plain")}
    res = client.post("/api/documents", files=files, headers=admin_headers)
    assert res.status_code == 400


def test_list_documents(client, employee_headers):
    res = client.get("/api/documents", headers=employee_headers)
    assert res.status_code == 200
    assert isinstance(res.json(), list)
