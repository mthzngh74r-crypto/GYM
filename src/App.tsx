import { lazy, Suspense } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { BottomNav } from './components/BottomNav';
import { TodayPage } from './features/today/TodayPage';
import { WorkoutPage } from './features/workout/WorkoutPage';
import { CalendarPage } from './features/calendar/CalendarPage';
const ProgressPage = lazy(() => import('./features/progress/ProgressPage').then((m) => ({ default: m.ProgressPage })));
const BodyPage = lazy(() => import('./features/body/BodyPage').then((m) => ({ default: m.BodyPage })));
import { MorePage } from './features/more/MorePage';
import { TemplatePage } from './features/template/TemplatePage';
import { ExercisesPage } from './features/template/ExercisesPage';
import { SettingsPage } from './features/settings/SettingsPage';

export default function App() {
  const loc = useLocation();
  const inWorkout = loc.pathname.startsWith('/workout/');
  return (
    <div className="min-h-full">
      <main className={`mx-auto max-w-xl ${inWorkout ? 'pb-40' : 'pb-24'}`}>
        <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<TodayPage />} />
          <Route path="/workout/:id" element={<WorkoutPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/progress" element={<ProgressPage />} />
          <Route path="/body" element={<BodyPage />} />
          <Route path="/more" element={<MorePage />} />
          <Route path="/template" element={<TemplatePage />} />
          <Route path="/exercises" element={<ExercisesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
        </Suspense>
      </main>
      {!inWorkout && <BottomNav />}
    </div>
  );
}
