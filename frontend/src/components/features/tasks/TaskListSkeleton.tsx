import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function TaskListSkeleton() {
  return (
    <div className="flex gap-4">
      {['待办', '进行中', '已完成'].map((col) => (
        <div key={col} className="flex-1 space-y-3">
          <div className="flex items-center gap-2 pb-2">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-6 rounded-full" />
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="p-3">
                <Skeleton className="h-4 w-3/4" />
              </CardHeader>
              <CardContent className="space-y-2 p-3 pt-0">
                <Skeleton className="h-3 w-full" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-12 rounded-full" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ))}
    </div>
  );
}
