# Orquestador Asincrónico (@nexora/orchestrator)

Motor encargado de procesar eventos del Outbox de forma segura y distribuida utilizando una estrategia agnóstica de origen de datos.

## Estructura
- `src/event-source/`: Contratos e implementaciones de extracción de eventos.
- `src/core/`: Reglas del orquestador y máquina de estados.
- `src/handlers/`: Lógica de negocio por tipo de evento.
- `src/repositories/`: Consultas transaccionales y acceso a la BD.
