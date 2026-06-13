'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function SchedulePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/main/tasks?view=gantt');
  }, [router]);

  return (
    <div className="flex items-center justify-center py-32">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
    </div>
  );
}
