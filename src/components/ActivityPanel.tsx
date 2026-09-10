import { ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { dateOf, formatDate, formatDay, formatTime, timeOf } from '@/data/dates'
import type { SnapshotIndex } from '@/data/index'
import { groupStyle } from '@/lib/groupColor'
import { cn } from '@/lib/utils'

interface ActivityPanelProps {
  index: SnapshotIndex
  activityId: number | null
  onClose: () => void
}

export function ActivityPanel({ index, activityId, onClose }: ActivityPanelProps) {
  const activity = activityId === null ? undefined : index.activityById.get(activityId)
  const center = activity && index.centerById.get(activity.centerId)
  const calendar = activity && index.calendarById.get(activity.calendarId)
  const facilities = activity
    ? activity.facilityIds.map((id) => index.facilityById.get(id)?.name).filter(Boolean)
    : []
  const sessions = activity ? index.snapshot.occurrences.filter((o) => o.a === activity.id) : []

  return (
    <Sheet open={activity !== undefined} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        {activity && (
          <>
            <SheetHeader className="p-6 pb-3">
              <div className="flex flex-wrap items-center gap-2">
                {calendar && (
                  <Badge
                    variant="secondary"
                    className={cn('gap-1.5', groupStyle(calendar.group).chip)}
                  >
                    <span className={cn('size-2 rounded-full', groupStyle(calendar.group).dot)} />
                    {calendar.name}
                  </Badge>
                )}
                {activity.free && <Badge variant="outline">Free</Badge>}
              </div>
              <SheetTitle className="text-xl">{activity.title}</SheetTitle>
              <SheetDescription>
                {center?.name}
                {facilities.length > 0 && ` · ${facilities.join(', ')}`}
              </SheetDescription>
            </SheetHeader>
            <ScrollArea className="min-h-0 flex-1 px-6">
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                {activity.ageText && <Row label="Ages">{activity.ageText}</Row>}
                {activity.priceText && <Row label="Price">{activity.priceText}</Row>}
                {activity.openings && <Row label="Openings">{activity.openings}</Row>}
                {activity.instructors.length > 0 && (
                  <Row label="Instructor">{activity.instructors.join(', ')}</Row>
                )}
                {activity.firstDate && activity.lastDate && (
                  <Row label="Runs">
                    {formatDate(activity.firstDate)} – {formatDate(activity.lastDate)}
                  </Row>
                )}
                {center?.address && <Row label="Address">{center.address}</Row>}
                {center?.phone && <Row label="Phone">{center.phone}</Row>}
              </dl>
              {activity.description && (
                <>
                  <Separator className="my-4" />
                  <div
                    className="prose prose-sm dark:prose-invert max-w-none text-sm [&_p]:my-2"
                    // Sanitized by the scraper to a small tag allowlist.
                    dangerouslySetInnerHTML={{ __html: activity.description }}
                  />
                </>
              )}
              <Separator className="my-4" />
              <h3 className="mb-2 text-sm font-medium">Sessions ({sessions.length})</h3>
              <ul className="mb-6 flex flex-col gap-1 text-sm tabular-nums">
                {sessions.map((o) => (
                  <li key={o.s} className="flex justify-between gap-4">
                    <span>{formatDay(dateOf(o.s))}</span>
                    <span className="text-muted-foreground">
                      {formatTime(timeOf(o.s))}–{formatTime(timeOf(o.e))}
                    </span>
                  </li>
                ))}
              </ul>
            </ScrollArea>
            <div className="border-t p-4">
              <Button asChild className="w-full">
                <a href={activity.url} target="_blank" rel="noopener noreferrer">
                  Details &amp; registration on ActiveNet <ExternalLink />
                </a>
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </>
  )
}
