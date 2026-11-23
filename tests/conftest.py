import pytest

from probcast.validation.fixtures import build_fixture_store


@pytest.fixture(scope="session")
def store():
    return build_fixture_store()
