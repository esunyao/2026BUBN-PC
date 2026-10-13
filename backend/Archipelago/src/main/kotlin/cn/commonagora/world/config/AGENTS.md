# Configuration module

Own world.auth/world.storage property binding, SQLite connection setup, environment templates and application configuration. Keep Spring Cloud compatibility verification enabled. No Nacos discovery dependency is installed; config import is optional, disabled by default, and refresh is off. Disabled storage must start without credentials; enabled incomplete storage must fail at startup. StorageProperties fields are frozen by the backend implementation contract.
