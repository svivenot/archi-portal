import json
import pytest
from pathlib import Path
from app.mcp_server import get_file_path, load_current_arch
from app import config

def test_get_file_path_traversal_protection():
    # Verify that parent directory segments are cleaned up to prevent path traversal
    dirty_path = "../../../etc/passwd"
    clean_path = get_file_path("test-project", dirty_path)
    
    assert "../" not in str(clean_path)
    assert "..\\" not in str(clean_path)
    assert clean_path.name == "passwd"

def test_load_current_arch_migration(tmp_path, monkeypatch):
    import app.mcp_server
    
    # Mock the DOCS_DIR path in both config and mcp_server modules to ensure isolation
    monkeypatch.setattr(config, "DOCS_DIR", str(tmp_path))
    monkeypatch.setattr(app.mcp_server, "DOCS_DIR", str(tmp_path))
    
    # Write a legacy JSON file missing the 'namespaces' configuration list
    legacy_data = {
        "services": [
            {"id": "s1", "name": "Service 1", "namespace": "Core"},
            {"id": "s2", "name": "Service 2", "namespace": "Billing"}
        ]
    }
    arch_file = tmp_path / "current_architecture.json"
    with open(arch_file, "w", encoding="utf-8") as f:
        json.dump(legacy_data, f)
        
    # Load through the migration parser helper
    loaded = load_current_arch()
    
    # Assert that 'namespaces' was auto-created and populated
    assert "namespaces" in loaded
    assert isinstance(loaded["namespaces"], list)
    ns_names = {ns["name"] for ns in loaded["namespaces"]}
    assert ns_names == {"Core", "Billing"}
