"""Settings read from environment variables.

Docker Compose loads them from the root .env; on Vercel they are set in the
project settings. Nothing here is kept between requests except constants.
"""

import os

DATABASE_URL = os.environ.get("DATABASE_URL", "")
