# Phase 2 sessions features — changes

Shipped three Post-MVP items from PRD §6.2:

## Group sessions
- `BookingGroup` + per-student `Booking.groupId`
- `POST /bookings/group` (tutor, 2–8 students)
- Jadwalkan Sesi multi-select student picker
- Calendar coalesce + BookingDetail roster

## Progress reports & homework
- `ProgressReport`, `HomeworkAssignment`, `HomeworkSubmission`
- Routes under `/bookings/:id/progress-report`, `/bookings/:id/homework`, `/homework/:id/submit|review`
- Booking detail UI sections + combined PDF fields

## Video / whiteboard
- Optional Daily.co (`DAILY_API_KEY`) for in-app rooms
- `GET /bookings/:id/session-token`, whiteboard GET/PUT
- `/bookings/[id]/session` page (Daily iframe + tldraw)
- Join CTA prefers “Buka ruang sesi”; Zoom/Meet remains fallback
