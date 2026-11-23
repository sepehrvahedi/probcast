"""R1.1 slice tests run against the R1.0 sealed-holdout behaviour (PROBCAST_HOLDOUT=sealed, D-089)."""

import os

os.environ.setdefault("PROBCAST_HOLDOUT", "sealed")
