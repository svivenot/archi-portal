import pytest
from fastapi.testclient import TestClient
from app.main import app, get_current_user
from app import config

@pytest.fixture
def client(tmp_path, monkeypatch):
    import app.main as app_module
    
    # Mock the global config path
    monkeypatch.setattr(config, "DOCS_DIR", str(tmp_path))
    
    # Mock main module paths (evaluated at import time)
    monkeypatch.setattr(app_module, "DOCS_DIR", str(tmp_path))
    monkeypatch.setattr(app_module, "CURRENT_ARCH_FILE", tmp_path / "current_architecture.json")
    monkeypatch.setattr(app_module, "ICONS_CONFIG_FILE", tmp_path / "icons.json")
    
    # Initialize mock project paths
    project_dir = tmp_path / "test_project"
    (project_dir / "arc42").mkdir(parents=True, exist_ok=True)
    (project_dir / "adrs").mkdir(parents=True, exist_ok=True)
    
    # Write sample documentation chapter
    intro_file = project_dir / "arc42" / "01_introduction_goals.md"
    intro_file.write_text("# Intro\nThis is a test introduction.", encoding="utf-8")
    
    # Override current user validation dependency
    app.dependency_overrides[get_current_user] = lambda: {
        "name": "Test Architect",
        "email": "test@local.dev",
        "roles": [config.REQUIRED_ROLE_ARCHITECT],
        "mock": True
    }
    
    with TestClient(app) as tc:
        yield tc
        
    app.dependency_overrides.clear()

def test_get_projects(client):
    response = client.get("/api/docs")
    assert response.status_code == 200
    data = response.json()
    assert any(p["name"] == "test_project" for p in data["projects"])

def test_get_current_architecture(client):
    response = client.get("/api/current-architecture")
    assert response.status_code == 200
    data = response.json()
    assert "services" in data
    assert "namespaces" in data

def test_update_current_architecture(client):
    # Retrieve current configuration
    response = client.get("/api/current-architecture")
    assert response.status_code == 200
    arch = response.json()
    
    # Add a mock service to the payload
    new_svc = {
        "id": "integration-test-svc",
        "name": "Integration Test Svc",
        "namespace": "Core",
        "type": "service",
        "description": "Integration testing service description",
        "version": "1.0.0",
        "status": "active"
    }
    arch["services"].append(new_svc)
    
    # Save the updated configuration
    save_response = client.post("/api/current-architecture", json=arch)
    assert save_response.status_code == 200
    
    # Verify the service is successfully stored
    verify_response = client.get("/api/current-architecture")
    verify_arch = verify_response.json()
    assert any(s["id"] == "integration-test-svc" for s in verify_arch["services"])
