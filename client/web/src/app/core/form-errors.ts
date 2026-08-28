import { AbstractControl, FormGroup, ValidationErrors } from '@angular/forms';
import { take } from 'rxjs';
import { ProblemDetails } from './models';

/** The password policy, stated once. It is shown as a hint before it can be broken, and reused
 * as the message when it is — so the rule a person reads and the rule they failed are one string. */
export const PASSWORD_RULE = 'Use at least 8 characters, including a letter and a number.';

/** Per-field wording that the generic rules below can't know — a password policy, for instance. */
export type MessageOverrides = Partial<Record<string, string>>;

/**
 * Puts a server's field errors onto the controls they belong to.
 *
 * This is what makes them visible at all: `<mat-error>` only renders while its control is in an
 * error state, so a message held in a component signal — the shape this app used to use — never
 * appeared for a field the client considered valid, which is exactly the case for "that email is
 * already registered". Writing the message into the control fixes that, and it also puts the
 * message under the field it is about instead of at the foot of the form.
 *
 * Returns whatever could not be matched to a control, for the caller to show as a banner.
 */
export function applyServerErrors(form: FormGroup, problem: ProblemDetails | null): string | null {
  clearServerErrors(form);
  if (!problem) return null;

  const entries = Object.entries(problem.errors ?? {});
  if (entries.length === 0) return problem.title ?? null;

  const unmatched: string[] = [];

  for (const [key, messages] of entries) {
    const message = messages?.[0];
    if (!message) continue;

    const control = findControl(form, key);
    if (!control) {
      unmatched.push(message);
      continue;
    }

    control.setErrors({ ...(control.errors ?? {}), server: message });
    control.markAsTouched();
  }

  // The message describes the request that was sent, so it stops being true the moment *any*
  // part of that request changes — not just the field it was pinned to. Watching the one control
  // left a corrected form unable to submit: sign in with the wrong password and the message lands
  // on `email`, so fixing the password cleared nothing, the form stayed invalid, and pressing the
  // button did nothing until the email was touched. One subscription on the form, cleared whole.
  if (entries.length > 0) {
    form.valueChanges.pipe(take(1)).subscribe(() => clearServerErrors(form));
  }

  return unmatched.length ? unmatched.join(' ') : null;
}

/** The message to show for one control: what the server said, else what the validators say. */
export function fieldMessage(
  form: FormGroup,
  name: string,
  label: string,
  overrides: MessageOverrides = {}
): string | null {
  const control = form.get(name);
  if (!control) return null;

  const errors = control.errors;
  if (!errors) return null;
  if (errors['server']) return errors['server'] as string;

  // Client-side rules only speak once the person has had a chance to fill the field in.
  if (!control.touched && !control.dirty) return null;
  return describe(errors, label, overrides);
}

/** True when a submit should be blocked *and* explained, rather than silently disabled. */
export function firstInvalidField(form: FormGroup): string | null {
  return Object.keys(form.controls).find(name => form.get(name)?.invalid) ?? null;
}

/** Marks everything touched so every unmet rule speaks at once when submit is pressed. */
export function revealErrors(form: FormGroup): void {
  form.markAllAsTouched();
}

function describe(errors: ValidationErrors, label: string, overrides: MessageOverrides): string | null {
  for (const key of Object.keys(errors)) {
    if (overrides[key]) return overrides[key]!;

    switch (key) {
      case 'required': return `${label} is required.`;
      case 'email': return "That doesn't look like an email address.";
      case 'minlength': return `Use at least ${errors['minlength'].requiredLength} characters.`;
      case 'maxlength': return `Keep ${label.toLowerCase()} to ${errors['maxlength'].requiredLength} characters or fewer.`;
      case 'min': return `Enter ${errors['min'].min} or more.`;
      case 'max': return `Enter ${errors['max'].max} or less.`;
      case 'pattern': return `${label} isn't in the expected format.`;
      // A datepicker names its failures after itself rather than after the generic min/max
      // rules, so without these a field can be invalid — blocking submit — with nothing said.
      case 'matDatepickerMin': return `${label} is earlier than the earliest date allowed.`;
      case 'matDatepickerMax': return `${label} is later than the latest date allowed.`;
      case 'matDatepickerParse': return `${label} isn't a date that can be read.`;
      case 'matDatepickerFilter': return `${label} isn't a date that can be chosen.`;
      default: break;
    }
  }
  return null;
}

/** ASP.NET names validation keys after the model property, whose casing is a serialiser setting
 * and not something a screen should depend on — so a control is matched either way. */
function findControl(form: FormGroup, key: string): AbstractControl | null {
  const direct = form.get(key);
  if (direct) return direct;

  const wanted = key.toLowerCase().split('.').pop();
  const match = Object.keys(form.controls).find(name => name.toLowerCase() === wanted);
  return match ? form.controls[match] : null;
}

/** Drops every message the server put on this form. Call it at the top of a submit: the answer
 *  to a request is not a reason to refuse to send that request again. */
export function clearServerErrors(form: FormGroup): void {
  Object.values(form.controls).forEach(clearServerError);
}

function clearServerError(control: AbstractControl): void {
  if (!control.errors?.['server']) return;
  const { server, ...rest } = control.errors;
  control.setErrors(Object.keys(rest).length ? rest : null);
}
