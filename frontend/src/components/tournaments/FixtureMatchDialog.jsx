import React, { useState } from 'react';
import { CalendarPlus, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/**
 * Crear el partido de una llave, para uno de mis grupos.
 *
 * Una llave de torneo no tiene fecha, hora ni cancha — es "estos dos se cruzan"
 * y nada más. El partido sí las necesita, así que se piden acá en vez de
 * inventarlas.
 *
 * Se crea a pedido y de a uno: si el fixture generara los partidos solo, una
 * liga de seis equipos llenaría la lista de todos con treinta partidos con fecha
 * puesta a dedo. Cada grupo crea el suyo cuando sabe cuándo juega.
 */
const HOY = new Date().toISOString().slice(0, 10);
const CAMPO = 'mt-1.5 h-11 bg-slate-50';

export default function FixtureMatchDialog({ open, onOpenChange, fixture, opciones, onCrear }) {
  const [groupId, setGroupId] = useState(opciones?.[0]?.group_id || '');
  const [modality, setModality] = useState('11');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [creando, setCreando] = useState(false);

  const elegido = opciones?.find((o) => o.group_id === groupId) || opciones?.[0];
  const completo = groupId && date && time && location.trim().length >= 3;

  const crear = async () => {
    if (!completo) return;
    setCreando(true);
    try {
      await onCrear({
        group_id: groupId,
        modality: Number(modality),
        date,
        time,
        location: location.trim(),
      });
      onOpenChange(false);
      setDate('');
      setTime('');
      setLocation('');
    } finally {
      setCreando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Crear el partido de esta llave</DialogTitle>
          <DialogDescription>
            Se crea en modo Equipo con DT: armás la alineación, tomás asistencia y
            cargás las estadísticas como en cualquier partido tuyo. El resultado
            va y viene con el torneo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {opciones?.length > 1 && (
            <div>
              <Label htmlFor="fixture-match-group">¿De qué grupo?</Label>
              <Select value={groupId} onValueChange={setGroupId}>
                <SelectTrigger id="fixture-match-group" className={CAMPO} data-testid="fixture-match-group">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {opciones.map((o) => (
                    <SelectItem key={o.group_id} value={o.group_id}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {elegido && (
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <span className="font-semibold">{elegido.name}</span> contra{' '}
              <span className="font-semibold">{elegido.rival}</span>
              {fixture?.stage_label ? ` · ${fixture.stage_label}` : ''}
            </p>
          )}

          <div>
            <Label htmlFor="fixture-match-modality">Modalidad</Label>
            <Select value={modality} onValueChange={setModality}>
              <SelectTrigger id="fixture-match-modality" className={CAMPO} data-testid="fixture-match-modality">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[5, 6, 7, 8, 9, 10, 11].map((n) => (
                  <SelectItem key={n} value={String(n)}>Fútbol {n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="fixture-match-date">Fecha</Label>
              <Input
                id="fixture-match-date"
                type="date"
                min={HOY}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={CAMPO}
                data-testid="fixture-match-date"
              />
            </div>
            <div>
              <Label htmlFor="fixture-match-time">Hora</Label>
              <Input
                id="fixture-match-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className={CAMPO}
                data-testid="fixture-match-time"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="fixture-match-location">Cancha</Label>
            <Input
              id="fixture-match-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Ej: Club Atlético"
              className={CAMPO}
              data-testid="fixture-match-location"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            onClick={crear}
            disabled={!completo || creando}
            shape="pill"
            className="h-11 w-full bg-turf-btn text-white hover:bg-turf-btn-dark disabled:active:scale-100"
            data-testid="fixture-match-create"
          >
            {creando ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CalendarPlus className="mr-2 h-4 w-4" />
            )}
            {creando ? 'Creando...' : 'Crear partido'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
