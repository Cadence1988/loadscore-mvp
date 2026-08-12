# Load Lifecycle and Local Match Notifications

Updated: 2026-08-12

## Implemented in extension 0.4.0

- Optional pickup, delivery, expected-empty, expiration, equipment, source, load ID, broker/reference, and lifecycle-status fields.
- Statuses remain distinct: Available, Viewed, Interested, Requested, Pending confirmation, Booked, Covered, Expired, and Rejected.
- Old saved loads remain compatible and default to Available.
- Invalid delivery/expected-empty sequences are rejected. An incomplete date/time pair is disclosed and never guessed.
- Expired, booked, covered, and rejected loads are excluded from the active-match badge.
- Chrome notifications are opt-in and off by default.
- A notification is evaluated only when the driver saves a load already known to LoadScore and that load matches the driver's local rules.
- Quiet hours, duplicate suppression, expiration checks, a dismiss action, and bounded local notification history are included.

## Honest boundaries

This milestone does not monitor load boards, scrape authenticated sites, run a cloud service, sync between devices, or guarantee that an offer is still available. Notifications apply only to opportunities received through LoadScore's current manual or user-controlled intake. Broker/reference notes and raw highlighted text are excluded from analytics and notification copy.

## Manual extension verification

After pulling the release, open `chrome://extensions`, select Reload on LoadScore, and accept the new Notifications permission. Confirm that notifications remain off until enabled. Save a matching load outside quiet hours and verify one notification appears; saving the same load again should not create another notification.

## Next product build

Operating Modes (Preferred, Flexible, and Recovery) remain planned and are not part of this milestone.
