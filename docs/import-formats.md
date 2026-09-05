# Batch import formats

Every import is a UTF-8 CSV with a header row. Column names must match exactly;
order does not matter. Values containing a comma must be quoted.

Age categories are always one of: `Sub Juniors`, `Juniors`, `Intermediates`,
`Seniors`.

---

## 1. Participants

**Where:** Participants → Import
**Creates:** participant records and their logins **in the event level selected
on that screen**. Chest numbers are issued per level, so the same number can be
reused at the next level, and an entrant who moves up is registered again there
with a new number.

| Column | Required | Notes |
| --- | --- | --- |
| `full_name` | yes | |
| `age_category` | yes | one of the four categories |
| `chest_number` | yes | unique **within the event level**; a clash is auto-renumbered and reported |
| `church` | yes | used for the champion church standing |
| `district` | yes | used for the champion district standing |
| `username` | yes | unique across the whole system, since it is the login; a clash gets `.1`, `.2` appended |
| `password` | yes | 8+ characters; hashed server-side on import |

```csv
full_name,age_category,chest_number,church,district,username,password
Anna Mathew,Juniors,101,Grace Church,North District,anna.mathew,changeme123
Jerry Thomas,Seniors,102,"Hope Church, Kottayam",South District,jerry.thomas,changeme456
```

---

## 2. Judges

**Where:** Judges → Import
**Creates:** judge records and their logins.

| Column | Required | Notes |
| --- | --- | --- |
| `full_name` | yes | |
| `username` | yes | unique, 3+ characters |
| `password` | yes | 8+ characters |
| `email` | yes | must be a valid address |
| `church` | yes | |
| `contact` | no | phone or alternative contact |

```csv
full_name,username,password,email,church,contact
Pr. Samuel George,samuel.george,changeme123,samuel@example.org,Grace Church,+91 98765 43210
Mrs. Leah Mathew,leah.mathew,changeme456,leah@example.org,Hope Church,
```

---

## 3. Events and their criteria

**Where:** Events → Import events
**Creates:** events under one event level, each with its scoring criteria.

One row per **criterion**. Rows sharing an event name and age category belong to
the same event, so a three-criteria event is three rows.

| Column | Required | Notes |
| --- | --- | --- |
| `event_name` | yes | |
| `age_category` | yes | blank means the event is open to all categories |
| `event_format` | yes | `stage` or `writing` |
| `entrant_type` | yes | `individual` or `group` |
| `event_order` | no | running order on the day |
| `time_limit` | no | minutes |
| `max_participants` | no | |
| `rules` | no | shown to organisers |
| `criterion_name` | yes | |
| `criterion_max` | yes | highest score a judge can give |
| `criterion_weight` | no | defaults to 1; a weight of 2 doubles that criterion |

```csv
event_name,age_category,event_format,entrant_type,event_order,time_limit,max_participants,rules,criterion_name,criterion_max,criterion_weight
Solo Song Female,Juniors,stage,individual,1,3,20,Three minutes maximum,Voice quality,10,1
Solo Song Female,Juniors,stage,individual,1,3,20,Three minutes maximum,Pronunciation,10,1
Solo Song Female,Juniors,stage,individual,1,3,20,Three minutes maximum,Expression,5,1
Bible Quiz,Seniors,writing,individual,2,45,,,Round one,20,1
Bible Quiz,Seniors,writing,individual,2,45,,,Round two,20,1
```

The event-level columns are read from the first row of each event; later rows
only contribute their criterion.

---

## 4. Entrants into events

**Where:** Events → Import entrants
**Adds:** existing participants to existing events. Creates nothing.

| Column | Required | Notes |
| --- | --- | --- |
| `chest_number` | yes | must already exist |
| `age_category` | yes | must match the participant's own category |
| `events` | yes | one or more event names, comma-separated, quoted |

```csv
chest_number,age_category,events
201,Juniors,"Solo Song Female, Bible Quiz"
202,Seniors,Speech
```

Events are matched on name **plus** age category, so `Bible Quiz` for Juniors
and `Bible Quiz` for Seniors stay separate. Already-registered pairs are skipped,
not duplicated.

---

## 5. Scores for events held off the app

**Where:** Results → Import scores
**Adds:** judge scores for an event that was run on paper, exactly as if the
judges had entered them in the app. Results are then calculated normally, so
placings, ties and championship points all follow the usual rules.

One row per **judge, per entrant, per criterion**.

| Column | Required | Notes |
| --- | --- | --- |
| `event_name` | yes | must already exist |
| `age_category` | yes | identifies which event of that name |
| `chest_number` | yes | the entrant; leave blank for a group event |
| `group_name` | only for group events | instead of `chest_number` |
| `judge_username` | yes | must be assigned to that event |
| `criterion_name` | yes | must match a criterion on that event |
| `score` | yes | 0 to the criterion's maximum, halves allowed |

```csv
event_name,age_category,chest_number,group_name,judge_username,criterion_name,score
Solo Song Female,Juniors,201,,samuel.george,Voice quality,8
Solo Song Female,Juniors,201,,samuel.george,Pronunciation,7.5
Solo Song Female,Juniors,201,,samuel.george,Expression,4
Action Song,Juniors,,Zion Youth Team,samuel.george,Voice quality,9
```

An entrant must have a score from a judge for **every** criterion, the same rule
the app applies to a judge scoring on a phone. Partial sheets are rejected with
the row numbers, so a half-typed import cannot skew an average.
