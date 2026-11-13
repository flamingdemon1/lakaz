# Team handoff

This is a proposed interface to agree before building. Change it together and update this file in the same change.

| Step | Shared contract |
|---|---|
| Device → backend | HTTPS; device credential issued separately from the public repo. The button sends `event_id` (unique per event) and `kind` (`help_requested`). Backend identifies the device from its credential, sets the received time and treats duplicate IDs for that device as retries. |
| Backend → app | An authenticated, linked carer can read the event ID, kind, received time and nullable acknowledgement time. The UI can use a sample event with these fields until the endpoint is ready. |
| App → backend | A linked carer acknowledges an event by ID. Backend checks access, saves the server time and returns updated state. Verify after refreshing. |
| Local dataset → app | Read-only facility records: name, type, district and source reference. Filter by the carer's selected district. |

Use separate device and carer credentials. Test that a different signed-in account cannot read or acknowledge the event. Only show success after the server confirms it. Capture the hardware trigger, visible alert and persisted acknowledgement in the same demo.
