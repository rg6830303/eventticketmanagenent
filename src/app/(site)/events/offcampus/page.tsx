import { permanentRedirect } from 'next/navigation';

/** OFF Campus is over; its record lives in the console. Send visitors to what is on sale. */
export default function OffCampusPage() {
  permanentRedirect('/');
}
