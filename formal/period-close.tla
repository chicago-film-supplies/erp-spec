------------------------------- MODULE period_close -------------------------------
(*
STUB — skeleton only. See formal/README.md. Filling this is m5.

Protocol under specification (ADR-0010, EVT-LED-002):
    A period close freezes an accounting period. After close, no posting may take an accounting
    date inside it — regardless of its posting timestamp.

The case that makes this non-trivial: a posting created BEFORE the close, whose commit lands
AFTER it. Posting timestamp and accounting date move independently, so "it arrived late" and
"it belongs to last month" are different facts and both are true at once.
*)

EXTENDS Naturals, Sequences

CONSTANTS Periods, Entries

VARIABLES
    closed,                 \* [period -> BOOLEAN]
    posted,                 \* [entry -> period \cup {"none"}]
    inFlight                \* entries begun but not committed

vars == <<closed, posted, inFlight>>

Init ==
    /\ closed   = [p \in Periods |-> FALSE]
    /\ posted   = [e \in Entries |-> "none"]
    /\ inFlight = {}

(* TODO: model begin/commit of an entry, and close of a period, interleaved. *)
Next == UNCHANGED vars

Spec == Init /\ [][Next]_vars

----------------------------------------------------------------------------
(* Invariants. Vacuous until Next is real.                                   *)

NoPostingIntoClosedPeriod ==
    \A e \in Entries :
        posted[e] # "none" => ~closed[posted[e]]

CloseIsMonotonic == TRUE    \* TODO: once closed, a period never reopens without an explicit reopen event

=============================================================================
