import logging
from datetime import date

logger = logging.getLogger(__name__)


def derive_total_experience_months(experiences) -> int:
    """Sum the duration of every experience entry in months.

    Entries flagged as currently working are measured up to today.
    Overlapping entries are summed naively (per-entry duration).
    """
    today = date.today()
    total_days = 0
    for exp in experiences:
        start = exp.start_date
        end = exp.end_date
        if getattr(exp, "currently_working", False) or end is None:
            end = max(today, start)
        if end < start:
            end = start
        total_days += (end - start).days
    return total_days // 30


def format_experience(months: int) -> str:
    if months <= 0:
        return "Fresher"
    years, rem = divmod(months, 12)
    if years and rem:
        return f"{years} yr {rem} mo"
    if years:
        return f"{years} yr"
    return f"{rem} mo"
