# tone-coach

## Environment Setup with Hatch

This project uses [Hatch](https://hatch.pypa.io/) for environment and dependency management. All dependencies are specified in `pyproject.toml`.

### Prerequisites

- Python 3.8 or newer
- [Hatch installed](https://hatch.pypa.io/latest/install/):
```bash
pip install --user hatch
```

### Create and Activate the Environment

From the project root directory, run:
```bash
hatch shell
```

This will create (if needed) and activate a virtual environment with all dependencies installed.

### Running Commands

You can run scripts or commands in the environment using:
```bash
hatch run <command>
```

For more, see the [Hatch documentation](https://hatch.pypa.io/latest/).
