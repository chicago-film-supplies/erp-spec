---------------------------- MODULE two_store_commit ----------------------------
(*
STUB — skeleton only. See formal/README.md. Filling this is SPIKE-002 / m5.

Protocol under specification (ADR-0003):
    1. TigerBeetle: create PENDING transfer
    2. MongoDB:     write the business document
    3. TigerBeetle: POST the transfer  (or VOID it if step 2 failed)

The three questions this must answer, from SPIKE-002:
    - Can a pending transfer be orphaned?
    - Can a Mongo document exist with no posted transfer?
    - Can a retry double-post?
*)

EXTENDS Naturals, Sequences, FiniteSets

CONSTANTS Requests          \* set of client request ids

VARIABLES
    tbState,                \* [req -> {"none","pending","posted","voided"}]
    mongoState,             \* [req -> {"absent","written"}]
    crashed

vars == <<tbState, mongoState, crashed>>

Init ==
    /\ tbState    = [r \in Requests |-> "none"]
    /\ mongoState = [r \in Requests |-> "absent"]
    /\ crashed    = FALSE

(* TODO: model each step, plus a crash between any two, plus retry of any step. *)
Next == UNCHANGED vars

Spec == Init /\ [][Next]_vars

----------------------------------------------------------------------------
(* Invariants. All currently vacuous — they pass because Next does nothing.  *)
(* A green run right now proves NOTHING. Land them red once Next is real.    *)

NoOrphanedPending ==
    \A r \in Requests :
        tbState[r] = "pending" => TRUE          \* TODO: bound how long, and by what resolves it

NoDocumentWithoutPosting ==
    \A r \in Requests :
        mongoState[r] = "written" => tbState[r] \in {"pending", "posted"}

NoDoublePost == TRUE                            \* TODO: needs a post-count, not a state enum

=============================================================================
