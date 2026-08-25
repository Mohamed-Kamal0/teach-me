import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { LoginResponse, MeResponse, UserRole } from './models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _me = signal<MeResponse | null>(null);
  private readonly _bootstrapped = signal(false);
  private readonly _serverUnreachable = signal(false);

  readonly me = this._me.asReadonly();
  readonly bootstrapped = this._bootstrapped.asReadonly();
  /** True when we could not reach the server at all — which is not the same as being signed out. */
  readonly serverUnreachable = this._serverUnreachable.asReadonly();
  readonly isAuthenticated = computed(() => this._me() !== null);
  readonly role = computed<UserRole | null>(() => this._me()?.role ?? null);

  constructor(private http: HttpClient) {}

  /** Called once at bootstrap — the single call that makes a session survive a page refresh. */
  async bootstrap(): Promise<void> {
    try {
      const me = await firstValueFrom(this.http.get<MeResponse>('/api/me'));
      this._me.set(me);
      this._serverUnreachable.set(false);
    } catch (err) {
      this._me.set(null);
      // A 401 means signed out. A status of 0 means the server never answered — telling someone
      // they are signed out when the API is down sends them to a login form that cannot work.
      this._serverUnreachable.set(err instanceof HttpErrorResponse && err.status === 0);
    } finally {
      this._bootstrapped.set(true);
    }
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await firstValueFrom(this.http.post<LoginResponse>('/api/auth/login', { email, password }));
    await this.refreshMe();
    return response;
  }

  async registerTeacher(fullName: string, email: string, password: string): Promise<void> {
    await firstValueFrom(this.http.post('/api/auth/register/teacher', { fullName, email, password }));
  }

  async registerStudent(fullName: string, email: string, password: string): Promise<void> {
    await firstValueFrom(this.http.post('/api/auth/register/student', { fullName, email, password }));
  }

  async logout(): Promise<void> {
    await firstValueFrom(this.http.post('/api/auth/logout', {}));
    this._me.set(null);
  }

  async refreshMe(): Promise<void> {
    try {
      const me = await firstValueFrom(this.http.get<MeResponse>('/api/me'));
      this._me.set(me);
    } catch {
      this._me.set(null);
    }
  }
}
