/**
 * Detail mode management for tool output
 */

export class DetailMode {
  private static _enabled: boolean = false;

  /**
   * Check if detail mode is enabled
   */
  static get enabled(): boolean {
    return this._enabled;
  }

  /**
   * Toggle detail mode on/off
   */
  static toggle(): boolean {
    this._enabled = !this._enabled;
    return this._enabled;
  }

  /**
   * Enable detail mode
   */
  static enable(): void {
    this._enabled = true;
  }

  /**
   * Disable detail mode
   */
  static disable(): void {
    this._enabled = false;
  }

  /**
   * Get status text for display
   */
  static getStatusText(): string {
    return this._enabled ? 'ENABLED' : 'DISABLED';
  }
}