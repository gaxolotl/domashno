import { Navigate, useParams } from 'react-router-dom';

// The timetable import + editor now lives in the Class settings tab.
export default function SchedulePage() {
  const { classId = '' } = useParams();
  return <Navigate to={`/class/${classId}/settings`} replace />;
}
