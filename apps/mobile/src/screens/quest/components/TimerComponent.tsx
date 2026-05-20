import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, StyleSheet } from 'react-native';
import { Text } from '../../../ui/primitives/Text';
import { colors } from '../../../ui/tokens';

interface Props {
  targetTimeString: string;
  color?: string;
}

interface TimeLeft {
  d: string;
  h: string;
  m: string;
  s: string;
}

function compute(targetTimeString: string): TimeLeft {
  const diff = new Date(targetTimeString).getTime() - Date.now();
  if (diff <= 0) return { d: '00', h: '00', m: '00', s: '00' };
  return {
    d: String(Math.floor(diff / 86_400_000)).padStart(2, '0'),
    h: String(Math.floor((diff % 86_400_000) / 3_600_000)).padStart(2, '0'),
    m: String(Math.floor((diff % 3_600_000) / 60_000)).padStart(2, '0'),
    s: String(Math.floor((diff % 60_000) / 1_000)).padStart(2, '0'),
  };
}

export default function TimerComponent({ targetTimeString, color }: Props) {
  const [time, setTime] = useState<TimeLeft>(() => compute(targetTimeString));
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef<AppStateStatus>('active');

  const tick = useCallback(() => setTime(compute(targetTimeString)), [targetTimeString]);

  useEffect(() => {
    tick();
    intervalRef.current = setInterval(tick, 1000);
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (appStateRef.current !== 'active' && next === 'active') tick();
      appStateRef.current = next;
    });
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      sub.remove();
    };
  }, [tick]);

  const { d, h, m } = time;
  const display = `${d !== '00' ? `${d}D ` : ''}${h}H ${m}M`;

  return (
    <Text variant="taskCardDesc" style={[styles.text, { color: color ?? colors.text3 }]}>
      {display}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    letterSpacing: 0.3,
  },
});
