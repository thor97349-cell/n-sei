import sys

if __name__ == "__main__":
    args = sys.argv[1:]
    if "--autoteste" in args:
        from pathlib import Path

        from foodcreator.selftest import run

        saida = next((a.split("=", 1)[1] for a in args if a.startswith("--saida=")), None)
        raise SystemExit(run(Path(saida) if saida else None))

    from foodcreator.app.main import main

    raise SystemExit(main())
