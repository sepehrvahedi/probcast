"""Descriptive evidence pack (R1.1 data slice): ratios, peers, indexed total return, rolling
betas, reverse DCF and event reactions. Every function is point in time: it reads the store
through an ``AsOfContext`` at the as-of session, so nothing accepted after that close is used.

The five report functions below are a shared contract (the report slice imports them by name):

* ``ratio_table(store, ticker, asof)``
* ``peer_table(store, tickers, asof)``
* ``indexed_total_return(store, tickers, start, asof)``
* ``rolling_betas(store, ticker, asof, factors=("FRED:DTWEXBGS", "FRED:DFII10"), window_weeks=156)``
* ``reverse_dcf(store, ticker, asof, *, cost_of_equity=None)``

These outputs are descriptive evidence only; they never join the committee (FR-ANZ-07).
"""

from probcast.descriptive.dcf import reverse_dcf
from probcast.descriptive.events import event_reaction, event_reactions
from probcast.descriptive.market import indexed_total_return, rolling_betas
from probcast.descriptive.peers import peer_medians, peer_sets, peer_table
from probcast.descriptive.ratios import ratio_table, registry

__all__ = [
    "event_reaction",
    "event_reactions",
    "indexed_total_return",
    "peer_medians",
    "peer_sets",
    "peer_table",
    "ratio_table",
    "registry",
    "reverse_dcf",
    "rolling_betas",
]
