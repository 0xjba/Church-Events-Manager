import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CornersOut, Trophy, X } from '@phosphor-icons/react';
import { supabase } from '@/integrations/supabase/client';
import { useEventLevel } from '@/hooks/useEventLevel';
import type { PlacedResult } from '@/utils/championship';
import { buildSlides, type Entrant, type EventBlock, type Slide } from '@/utils/winnersSlides';
import { Button } from '@/components/ui/primitives';

/*
 * Winners presentation.
 *
 * A prize-giving read off a projector, one placing at a time. Placings run
 * third to first so the room builds to the winner, and each event is announced
 * before its first placing is shown.
 *
 * Scores never appear here. Only admins may see points, and this screen is
 * pointed at a hall.
 */

const RANK_LABEL: Record<number, string> = { 1: 'First place', 2: 'Second place', 3: 'Third place' };
const RANK_SHORT: Record<number, string> = { 1: '1st', 2: '2nd', 3: '3rd' };

const WinnersPresentation = () => {
  const navigate = useNavigate();
  const { levelId, level } = useEventLevel();

  const [slides, setSlides] = useState<Slide[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!levelId) return;

      try {
        setLoading(true);
        setError(null);

        // Published means what the database means by it in
        // event_results_visible: the event's own flag, or its level's. An
        // event's status is set by hand and never on publishing, so it plays
        // no part.
        const query = supabase
          .from('events')
          .select('id, name, age_category, event_type, event_order')
          .eq('level_id', levelId)
          .order('event_order', { ascending: true, nullsFirst: false });

        const { data: events, error: eventsError } = await (level?.results_published
          ? query
          : query.eq('results_published', true));

        if (eventsError) throw eventsError;
        if (!events?.length) {
          if (!cancelled) setSlides([]);
          return;
        }

        const { data: results, error: resultsError } = await supabase
          .from('results')
          .select(
            `event_id, rank,
             participant:participants( id, full_name, chest_number, church, district ),
             group:groups( id, name, chest_number, church, district )`,
          )
          .in('event_id', events.map((event) => event.id))
          .not('rank', 'is', null)
          .lte('rank', 3)
          .order('rank', { ascending: true });

        if (resultsError) throw resultsError;

        const blocks: EventBlock[] = [];
        const placed: PlacedResult[] = [];

        for (const event of events) {
          const entrantType = event.event_type === 'group' ? 'group' : 'individual';
          const mine = (results ?? []).filter((row) => row.event_id === event.id);
          if (mine.length === 0) continue;

          // A tie shares a rank, so a placing can name more than one entrant.
          const byRank = new Map<number, Entrant[]>();
          for (const row of mine) {
            const subject = entrantType === 'group' ? row.group : row.participant;
            if (!subject) continue;

            placed.push({
              event_id: event.id,
              event_type: entrantType,
              rank: row.rank,
              participant: row.participant,
              group: row.group,
            });

            const entrant: Entrant = {
              name: 'name' in subject ? subject.name : subject.full_name,
              chestNumber: subject.chest_number ?? null,
              church: subject.church ?? null,
            };
            byRank.set(row.rank as number, [...(byRank.get(row.rank as number) ?? []), entrant]);
          }

          if (byRank.size === 0) continue;

          blocks.push({
            id: event.id,
            name: event.name,
            ageCategory: event.age_category,
            entrantType,
            placings: [...byRank.entries()].map(([rank, entrants]) => ({ rank, entrants })),
          });
        }

        const built = buildSlides(blocks, placed, level?.scope);

        if (!cancelled) {
          setSlides(built);
          setIndex(0);
        }
      } catch (loadError) {
        console.error('Failed to load the winners presentation', loadError);
        if (!cancelled) setError('Could not load the winners for this level.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [levelId, level?.scope, level?.results_published]);

  const next = useCallback(() => setIndex((i) => Math.min(i + 1, slides.length - 1)), [slides.length]);
  const previous = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), []);
  const exit = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    navigate('/admin/results');
  }, [navigate]);

  useEffect(() => {
    const onKey = (keyEvent: KeyboardEvent) => {
      if (['ArrowRight', ' ', 'PageDown', 'Enter'].includes(keyEvent.key)) {
        keyEvent.preventDefault();
        next();
      } else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(keyEvent.key)) {
        keyEvent.preventDefault();
        previous();
      } else if (keyEvent.key === 'Escape' && !document.fullscreenElement) {
        exit();
      } else if (keyEvent.key.toLowerCase() === 'f') {
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, previous, exit]);

  const slide = slides[index];

  if (loading) return <Centered>Loading winners…</Centered>;
  if (error) return <Centered action={<Button onClick={exit}>Back to results</Button>}>{error}</Centered>;
  if (!slides.length) {
    return (
      <Centered action={<Button onClick={exit}>Back to results</Button>}>
        Nothing to present yet. Publish an event's results and they appear here.
      </Centered>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-primary text-primary-foreground">
      {/* The whole stage advances, so a presenter can tap anywhere. */}
      <button
        type="button"
        onClick={next}
        aria-label="Next slide"
        className="flex flex-1 cursor-pointer items-center justify-center px-8 py-16 text-center"
      >
        <div className="w-full max-w-4xl">{renderSlide(slide, level?.name ?? '')}</div>
      </button>

      <div className="pb-safe px-safe flex items-center gap-3 px-6 py-4 text-primary-foreground/70">
        <span className="tnum text-caption">
          {index + 1} / {slides.length}
        </span>
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-primary-foreground/20">
          <div
            className="h-full rounded-full bg-primary-foreground/70 transition-all"
            style={{ width: `${((index + 1) / slides.length) * 100}%` }}
          />
        </div>
        <IconButton label="Previous slide" onClick={previous} disabled={index === 0}>
          <ArrowLeft size={18} />
        </IconButton>
        <IconButton label="Next slide" onClick={next} disabled={index === slides.length - 1}>
          <ArrowRight size={18} />
        </IconButton>
        <IconButton label="Full screen" onClick={toggleFullscreen}>
          <CornersOut size={18} />
        </IconButton>
        <IconButton label="Exit presentation" onClick={exit}>
          <X size={18} />
        </IconButton>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------- slides */


const renderSlide = (slide: Slide, levelName: string) => {
  if (!slide) return null;

  if (slide.kind === 'event') {
    return (
      <>
        <p className="text-[clamp(1rem,2.2vw,1.75rem)] uppercase tracking-[0.2em] text-primary-foreground/60">Next event</p>
        <h1 className="mt-6 text-[clamp(2.75rem,8vw,6.5rem)] font-semibold leading-tight">
          {slide.event.name}
        </h1>
        {slide.event.ageCategory && (
          <p className="mt-4 text-[clamp(1.25rem,3vw,2rem)] text-primary-foreground/75">
            {slide.event.ageCategory}
          </p>
        )}
      </>
    );
  }

  if (slide.kind === 'placing') {
    const nameSize =
      slide.entrants.length > 1
        ? 'text-[clamp(1.75rem,5vw,4rem)]'
        : 'text-[clamp(2.75rem,9vw,8rem)]';

    return (
      <>
        <p className="text-[clamp(1rem,2.2vw,1.75rem)] text-primary-foreground/60">
          {slide.event.name}
          {slide.event.ageCategory ? ` · ${slide.event.ageCategory}` : ''}
        </p>
        <p className="mt-8 text-[clamp(1.5rem,4vw,2.5rem)] uppercase tracking-[0.2em] text-primary-foreground/70">
          {RANK_LABEL[slide.rank] ?? `Rank ${slide.rank}`}
        </p>
        <div className={slide.entrants.length > 1 ? 'mt-6 space-y-4' : 'mt-6 space-y-6'}>
          {slide.entrants.map((entrant) => (
            <div key={`${entrant.name}-${entrant.chestNumber}`}>
              <p className={`${nameSize} font-semibold leading-none`}>{entrant.name}</p>
              <p className="mt-4 text-[clamp(1.1rem,2.5vw,1.75rem)] text-primary-foreground/75">
                {[entrant.chestNumber ? `#${entrant.chestNumber}` : null, entrant.church]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
          ))}
        </div>
        {slide.entrants.length > 1 && (
          <p className="mt-8 text-[clamp(1rem,2.2vw,1.5rem)] text-primary-foreground/60">
            Tied for {RANK_SHORT[slide.rank] ?? `rank ${slide.rank}`}
          </p>
        )}
      </>
    );
  }

  if (slide.kind === 'champion') {
    return (
      <>
        <Trophy size={64} weight="fill" className="mx-auto text-primary-foreground/80" />
        <p className="mt-6 text-[clamp(1.5rem,4vw,2.5rem)] uppercase tracking-[0.2em] text-primary-foreground/70">
          {slide.title}
        </p>
        <div className="mt-6 space-y-4">
          {slide.winners.map((winner) => (
            <p
              key={winner}
              className={`${
                slide.winners.length > 1
                  ? 'text-[clamp(1.75rem,5vw,4rem)]'
                  : 'text-[clamp(2.75rem,9vw,8rem)]'
              } font-semibold leading-none`}
            >
              {winner}
            </p>
          ))}
        </div>
        <p className="mt-8 text-[clamp(1.1rem,2.5vw,1.75rem)] text-primary-foreground/75">
          {slide.tied ? `Shared · ${slide.caption}` : slide.caption}
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="text-[clamp(2rem,6vw,4rem)] font-semibold leading-tight">Congratulations</h1>
      <p className="mt-6 text-[clamp(1.1rem,2.5vw,1.75rem)] text-primary-foreground/75">{levelName}</p>
    </>
  );
};

/* ------------------------------------------------------------- pieces */

const toggleFullscreen = () => {
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => undefined);
  } else {
    document.documentElement.requestFullscreen().catch(() => undefined);
  }
};

const Centered = ({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) => (
  <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-primary px-8 text-center text-primary-foreground">
    <p className="max-w-md text-title">{children}</p>
    {action}
  </div>
);

const IconButton = ({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    title={label}
    className="flex h-10 w-10 items-center justify-center rounded-lg text-primary-foreground/70 transition-colors hover:bg-primary-foreground/10 hover:text-primary-foreground disabled:opacity-30"
  >
    {children}
  </button>
);

export default WinnersPresentation;
