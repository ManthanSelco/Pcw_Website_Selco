import FormModal from './FormModal.jsx';
import { formatDate, timeRange } from '../api.js';

const FIELDS = [
  { name: 'name', label: 'Your name', required: true },
  { name: 'email', label: 'Email', type: 'email', required: true },
  { name: 'phone', label: 'Phone', type: 'tel' },
  { name: 'organisation', label: 'Organisation' },
  { name: 'people', label: 'How many people (incl. you)?', type: 'number', min: 1, max: 20 },
];

export default function RsvpModal({ event, onClose }) {
  return (
    <FormModal
      title={`RSVP: ${event.title}`}
      intro={[formatDate(event.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }), timeRange(event), event.venue].filter(Boolean).join(' · ')}
      fields={FIELDS}
      submitLabel="Confirm RSVP"
      endpoint="/api/rsvp"
      extra={{ eventId: event.id }}
      onClose={onClose}
    />
  );
}
