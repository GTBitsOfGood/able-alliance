# Auto-Scheduling

Auto-scheduling solves a binary mixed-integer linear program (MILP) for one weekday's ride requests. Pickups are fixed at the scheduled time plus any delay.

## Variables

Both variables are binary.

- $x_{rdv}=1$ assigns ride $r$ to driver $d$ and vehicle $v$
  - A variable exists only if pickup is between 7:30 a.m. and 7:45 p.m. inclusive, an active driver's shift covers the full ride, the active vehicle meets the ride's wheelchair requirement, and both resources are compatible with their existing bookings.
- $y_{dv}=1$ marks driver–vehicle pair $(d,v)$ as active
  - A variable exists for each pair with at least one eligible ride. Any assignment using the pair forces it to 1.

## Objective

```math
\max \quad
\underbrace{\sum_{r,d,v}(w_{\mathrm{ride}} - w_{\mathrm{access}}a_{rv})x_{rdv}}_{\text{Ride assignment reward}}
- \underbrace{\sum_{d,v}c_{dv}y_{dv}}_{\text{New driver–vehicle pair penalty}}
```

- $w_{\mathrm{ride}} = 1000$ is the current base reward per assigned ride.
- $w_{\mathrm{access}} = 0.1$ is the current penalty for assigning a wheelchair-accessible vehicle to a ride that does not require one.
- $a_{rv}=1$ if $v$ is wheelchair-accessible and $r$ does not require it, and $0$ otherwise.
  - Applies the accessibility penalty to favor keeping accessible vehicles available for rides that need them.
- $c_{dv}=0$ if an existing booking that touches the day uses $(d,v)$, and $1$ otherwise.
  - Charges 1 per new pair to encourage drivers to reuse the same vehicle across rides.

## Subject to

Ineligible triples contribute zero to the sums. The constraints apply to each ride, each incompatible pair of rides for every driver and vehicle, and each eligible driver–vehicle pair.

| Constraint                       | Rule                                                           |
| -------------------------------- | -------------------------------------------------------------- |
| $\sum_{d,v}x_{rdv}\le 1$         | Each ride gets at most one assignment.                         |
| $\sum_v(x_{rdv}+x_{sdv})\le 1$   | Incompatible rides cannot share a driver.                      |
| $\sum_d(x_{rdv}+x_{sdv})\le 1$   | Incompatible rides cannot share a vehicle.                     |
| $\sum_r x_{rdv}\le M_{dv}y_{dv}$ | Using a pair activates it. $M_{dv}$ counts its eligible rides. |

Two rides are compatible if either order leaves room for 5 minutes of turnaround plus estimated travel from drop-off to the next pickup. A ride ends at its delayed drop-off estimate, or at pickup plus estimated travel if no drop-off estimate exists. The end is floored at pickup before adding 10 minutes for wheelchair accommodations, 5 for other accommodations, or 0 otherwise.

## Solving

[HiGHS](https://highs.dev/) has a 20-second solver time limit. Generation returns proposed assignments, unassigned rides with reasons, and the solver status.
