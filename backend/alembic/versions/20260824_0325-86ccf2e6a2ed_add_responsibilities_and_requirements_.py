"""add responsibilities and requirements to jobs

Revision ID: 86ccf2e6a2ed
Revises: e495cc094c2c
Create Date: 2026-08-24 03:25:27.099361

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '86ccf2e6a2ed'
down_revision: Union[str, None] = 'e495cc094c2c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new columns as nullable first
    op.add_column('jobs', sa.Column('responsibilities', sa.Text(), nullable=True))
    op.add_column('jobs', sa.Column('requirements', sa.Text(), nullable=True))

    # Copy data from description to responsibilities (and requirements)
    op.execute("UPDATE jobs SET responsibilities = description, requirements = description")

    # Make new columns non-nullable
    op.alter_column('jobs', 'responsibilities', nullable=False)
    op.alter_column('jobs', 'requirements', nullable=False)

    # Drop old description column
    op.drop_column('jobs', 'description')


def downgrade() -> None:
    # Add description column back
    op.add_column('jobs', sa.Column('description', sa.TEXT(), autoincrement=False, nullable=True))

    # Copy data back (use responsibilities as description)
    op.execute("UPDATE jobs SET description = responsibilities")

    # Make description non-nullable
    op.alter_column('jobs', 'description', nullable=False)

    # Drop new columns
    op.drop_column('jobs', 'requirements')
    op.drop_column('jobs', 'responsibilities')
