pushd python/samples/fastapi
set -a
source ../../../.env
set +a
uvicorn main:app --host 0.0.0.0 --port "${PORT:-3978}"
popd