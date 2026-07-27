.PHONY: help install install-dev test lint format doctor backtest paper web clean

help:  ## Muestra esta ayuda
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

install:  ## Instala las dependencias de ejecución
	pip install -r requirements.txt

install-dev:  ## Instala dependencias de desarrollo
	pip install -r requirements-dev.txt

test:  ## Ejecuta la suite de tests (sin red)
	pytest -q

test-cov:  ## Tests con informe de cobertura
	pytest --cov=bot --cov-report=term-missing

lint:  ## Comprueba estilo y tipos
	ruff check bot tests
	mypy bot

format:  ## Formatea el código
	ruff format bot tests
	ruff check --fix bot tests

doctor:  ## Valida la configuración y el entorno
	python -m bot doctor

backtest:  ## Backtest sobre el histórico en caché
	python -m bot backtest --days 365 -o backtest_output

paper:  ## Arranca paper trading 24/7
	python -m bot paper

web:  ## Solo el panel web
	python -m bot web

clean:  ## Borra artefactos temporales (NO borra data/ ni logs/)
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	rm -rf .pytest_cache .mypy_cache .ruff_cache htmlcov .coverage backtest_output
