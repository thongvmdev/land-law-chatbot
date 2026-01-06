#!/bin/bash
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE DATABASE langgraph_persistence;
    CREATE DATABASE index_vector;
    GRANT ALL PRIVILEGES ON DATABASE langgraph_persistence TO $POSTGRES_USER;
    GRANT ALL PRIVILEGES ON DATABASE index_vector TO $POSTGRES_USER;
EOSQL