/**
 * Integration tests for detail mode functionality
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { DetailMode } from '../src/core/detail-mode.js';

describe('Detail Mode Integration', () => {
  beforeEach(() => {
    // Reset detail mode before each test
    DetailMode.disable();
  });

  it('should toggle state correctly', () => {
    expect(DetailMode.enabled).toBe(false);
    
    const firstToggle = DetailMode.toggle();
    expect(firstToggle).toBe(true);
    expect(DetailMode.enabled).toBe(true);
    expect(DetailMode.getStatusText()).toBe('ENABLED');
    
    const secondToggle = DetailMode.toggle();
    expect(secondToggle).toBe(false);
    expect(DetailMode.enabled).toBe(false);
    expect(DetailMode.getStatusText()).toBe('DISABLED');
  });

  it('should allow manual enable/disable', () => {
    DetailMode.enable();
    expect(DetailMode.enabled).toBe(true);
    
    DetailMode.disable();
    expect(DetailMode.enabled).toBe(false);
  });

  it('should handle multiple toggles', () => {
    const states = [];
    for (let i = 0; i < 5; i++) {
      DetailMode.toggle();
      states.push(DetailMode.enabled);
    }
    
    expect(states).toEqual([true, false, true, false, true]);
  });

  it('should persist state between operations', () => {
    DetailMode.enable();
    expect(DetailMode.enabled).toBe(true);
    
    // Simulate multiple operations checking the state
    for (let i = 0; i < 10; i++) {
      expect(DetailMode.enabled).toBe(true);
    }
    
    DetailMode.disable();
    expect(DetailMode.enabled).toBe(false);
    
    // Check persistence of disabled state
    for (let i = 0; i < 10; i++) {
      expect(DetailMode.enabled).toBe(false);
    }
  });
});