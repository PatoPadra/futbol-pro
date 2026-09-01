import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import { Camera, ChevronDown, Loader2, AlertCircle, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/common/PageHeader';
import Reveal from '@/components/common/Reveal';
import PositionPicker from '@/components/players/PositionPicker';
import GenderPicker from '@/components/players/GenderPicker';
import { GENERO_IDS } from '@/constants/generos';
import { cn } from '@/lib/utils';
import { usePrefersReducedMotion } from '@/hooks/use-media-preferences';

const todayISO = () => new Date().toISOString().split('T')[0];

const profileSchema = z.object({
  name: z.string().trim().min(1, 'Ingresá tu nombre'),
  birth_date: z
    .string()
    .min(1, 'Ingresá tu fecha de nacimiento')
    .refine((v) => v <= todayISO(), 'La fecha de nacimiento no puede ser futura'),
  // Se pide en el alta y no queda opcional porque el balanceador lo usa para
  // repartir los mixtos. "Prefiero no decir" es la salida para quien no lo
  // quiera declarar, así que pedirlo no obliga a nadie a nada.
  gender: z.enum(GENERO_IDS, { errorMap: () => ({ message: 'Elegí tu género' }) }),
  primary_position: z.string().min(1, 'Seleccioná tu posición principal'),
  secondary_positions: z.array(z.string()).max(3).default([]),
  unwanted_position: z.string().default(''),
});

/**
 * Los campos obligatorios en el orden en que se ven en pantalla.
 *
 * No es el orden en que `zod` devuelve los errores: `Object.values(errors)[0]`
 * podía nombrar cualquiera de los cuatro. Al mandar el foco a ese campo,
 * importa que sea el PRIMERO que la persona se salteó, no uno arbitrario.
 */
const CAMPOS_EN_ORDEN = ['name', 'birth_date', 'gender', 'primary_position'];

const INPUT_BASE =
  'mt-1.5 h-12 bg-slate-50 focus-visible:ring-2 focus-visible:ring-turf/30';

/**
 * Mensaje mostrable de un error de la API.
 *
 * El `detail` de FastAPI es un string en los errores que tiramos nosotros, pero
 * en los 422 de validación es una LISTA de objetos. Pasársela a `toast` rompe
 * el render, así que todo lo que no sea string cae al texto por defecto.
 */
function mensajeDeError(err, porDefecto) {
  const detail = err?.response?.data?.detail;
  return typeof detail === 'string' && detail ? detail : porDefecto;
}

/**
 * Encabezado de sección del onboarding.
 *
 * Lleva el número del paso adelante: no es un wizard (todo se completa en una
 * sola pantalla y se guarda de una), pero numerar las tres partes convierte una
 * pila de campos en algo que se ve terminable.
 */
function PasoSeccion({ paso, titulo, ayuda, children, testId }) {
  return (
    <Card className="rounded-3xl border-slate-100 shadow-lift" data-testid={testId}>
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-turf/10 font-heading text-lg font-bold leading-none text-turf-accessible"
          >
            {paso}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-heading text-xl font-bold uppercase leading-tight tracking-tight text-slate-900">
              {titulo}
            </h2>
            {ayuda && <p className="mt-1 text-sm text-slate-600">{ayuda}</p>}
          </div>
        </div>
        <div className="mt-5">{children}</div>
      </CardContent>
    </Card>
  );
}

/**
 * Campo opcional plegado.
 *
 * POR QUÉ EXISTE: los dos selectores opcionales de posición ocupaban 1408 px de
 * los 3745 que medía el formulario en un celular — el 38% del alta era campos
 * que nadie está obligado a llenar. Once opciones desplegadas cada uno, dos
 * veces, entre la posición principal y el botón de guardar.
 *
 * Plegados pasan a ser dos renglones. Quien los quiera, los abre; quien no,
 * llega al botón. El resumen de lo elegido se muestra cerrado para que nadie
 * pierda de vista lo que cargó.
 */
function CampoOpcional({ titulo, ayuda, resumen, abierto, onToggle, testId, children }) {
  const panelId = `${testId}-panel`;
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={abierto}
        aria-controls={panelId}
        data-testid={`${testId}-toggle`}
        className="flex min-h-[60px] w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-900">{titulo}</span>
          <span className="mt-0.5 block text-xs text-slate-600">
            {!abierto && resumen ? resumen : ayuda}
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            'h-5 w-5 shrink-0 text-slate-500 transition-transform motion-reduce:transition-none',
            abierto && 'rotate-180',
          )}
        />
      </button>
      {abierto && (
        <div id={panelId} className="px-4 pb-4">
          {children}
        </div>
      )}
    </div>
  );
}

export default function CompleteProfile() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const reducedMotion = usePrefersReducedMotion();
  const [positions, setPositions] = useState([]);
  const [positionsLoading, setPositionsLoading] = useState(true);
  const [positionsError, setPositionsError] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [verSecundarias, setVerSecundarias] = useState(false);
  const [verNoDeseada, setVerNoDeseada] = useState(false);
  const fileInputRef = useRef(null);
  // Un contenedor por campo obligatorio, para poder llevar el scroll y el foco
  // hasta el que falta cuando el formulario no valida.
  const camposRef = useRef({});
  const registrarCampo = (nombre) => (el) => { camposRef.current[nombre] = el; };

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || '',
      birth_date: '',
      gender: '',
      primary_position: '',
      secondary_positions: [],
      unwanted_position: '',
    },
  });

  const gender = watch('gender');
  const primaryPosition = watch('primary_position');
  const secondaryPositions = watch('secondary_positions') || [];
  const unwantedPosition = watch('unwanted_position');

  /**
   * Lo elegido, en nombres, para mostrarlo con el campo plegado. Devuelve ''
   * cuando no hay nada, y el llamador cae en el texto de ayuda.
   */
  const nombresDePosiciones = (seleccion) => {
    const ids = Array.isArray(seleccion) ? seleccion : (seleccion ? [seleccion] : []);
    if (ids.length === 0) return '';
    return ids
      .map((id) => positions.find((p) => p.id === id)?.name || id)
      .join(', ');
  };

  const loadPositions = useCallback(() => {
    setPositionsLoading(true);
    setPositionsError(false);
    api.get('/positions')
      .then(res => setPositions(res.data))
      .catch(() => setPositionsError(true))
      .finally(() => setPositionsLoading(false));
  }, []);

  useEffect(() => {
    loadPositions();
  }, [loadPositions]);

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('El archivo tiene que ser una imagen (JPG, PNG, etc.)');
      return;
    }
    const maxSizeMB = 5;
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(`La imagen no puede superar los ${maxSizeMB}MB`);
      return;
    }

    setPhoto(file);
    setPhotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };

  const openFilePicker = () => fileInputRef.current?.click();

  // Sin esto no había forma de arrepentirse: una vez elegida la foto, si la
  // subida fallaba se reintentaba con la misma foto y fallaba igual. La única
  // salida era recargar la página.
  const quitarFoto = () => {
    setPhoto(null);
    setPhotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const selectPrimary = (posId) => {
    setValue('primary_position', posId, { shouldValidate: true });
    setValue('secondary_positions', secondaryPositions.filter(s => s !== posId), { shouldValidate: true });
  };

  const toggleSecondary = (posId) => {
    if (secondaryPositions.includes(posId)) {
      setValue('secondary_positions', secondaryPositions.filter(p => p !== posId), { shouldValidate: true });
      return;
    }
    if (secondaryPositions.length >= 3) {
      toast.error('Máximo 3 posiciones secundarias');
      return;
    }
    if (posId === primaryPosition) return;
    setValue('secondary_positions', [...secondaryPositions, posId], { shouldValidate: true });
  };

  const toggleUnwanted = (posId) => {
    setValue('unwanted_position', unwantedPosition === posId ? '' : posId, { shouldValidate: true });
  };

  /**
   * El PERFIL PRIMERO y la foto después.
   *
   * Antes la foto se subía antes del PUT, así que un fallo en la subida
   * —Cloudinary sin configurar, la red del celular, un timeout— cortaba la
   * función y el perfil no se guardaba nunca, aunque la persona hubiera
   * completado todo. Combinado con que la foto es el paso 1 y no se podía
   * quitar, el alta quedaba trabada de verdad: reintentar fallaba igual.
   *
   * La foto es opcional y su fallo no puede costar el alta. Va después, y si
   * se cae se avisa pero se sigue: el perfil ya está guardado.
   */
  const onSubmit = async (data) => {
    setLoading(true);
    try {
      await api.put('/profile', data);
      updateUser({ has_profile: true });

      let fotoFallo = false;
      if (photo) {
        try {
          const fd = new FormData();
          fd.append('file', photo);
          await api.post('/profile/photo', fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        } catch (errFoto) {
          fotoFallo = true;
          // Mensaje fijo y tranquilizador: lo único que la persona necesita
          // saber es que su perfil está a salvo. El motivo real ("el servicio
          // de fotos no está configurado") es información de operaciones, no
          // algo que un jugador pueda accionar; va a la consola.
          console.warn('No se pudo subir la foto de perfil:', mensajeDeError(errFoto, errFoto?.message));
          toast.warning('Guardamos tu perfil. La foto no se pudo subir — la podés cargar después desde tu perfil.');
        }
      }

      if (!fotoFallo) toast.success('¡Perfil completado!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(mensajeDeError(err, 'No pudimos guardar tu perfil. Intentá de nuevo.'));
    } finally {
      setLoading(false);
    }
  };

  /**
   * Llevar a la persona hasta el campo que falta.
   *
   * Antes esto sólo tiraba un toast. En un celular el botón de guardar está al
   * final del formulario y el campo sin completar podía quedar a dos mil
   * píxeles hacia arriba: el mensaje decía qué faltaba, pero no dónde, y había
   * que salir a buscarlo a mano. Ahora el scroll y el foco van al primer campo
   * incompleto en orden visual.
   */
  const onInvalid = (formErrors) => {
    const campo =
      CAMPOS_EN_ORDEN.find((c) => formErrors[c]) || Object.keys(formErrors)[0];
    if (!campo) return;

    toast.error(formErrors[campo]?.message || 'Faltan datos para completar tu perfil.');

    const contenedor = camposRef.current[campo];
    if (!contenedor) return;

    contenedor.scrollIntoView({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'center',
    });

    // Enfocar VA DESPUÉS y a propósito sin `preventScroll`: el scroll que el
    // navegador hace al enfocar es la red de seguridad por si `scrollIntoView`
    // no llegara a aplicarse. Cuando sí se aplicó, el campo ya quedó centrado y
    // enfocar no mueve nada más, porque ese scroll es el mínimo necesario.
    //
    // Género y posición principal no son inputs sino grupos de botones, así que
    // el foco cae en el primer botón del grupo.
    contenedor.querySelector('input, button, select, textarea')?.focus();
  };

  return (
    <div className="page-container mx-auto max-w-2xl" data-testid="complete-profile-page">
      <PageHeader
        slug="completar-perfil"
        priority
        icono={Users}
        eyebrow="Último paso antes de jugar"
        titulo="Completá tu perfil"
        bajada="Necesitamos algunos datos para armar equipos equilibrados. Son dos minutos y después ya estás adentro."
        testId="complete-profile-header"
      />

      <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="mt-6 space-y-5" noValidate>
        {/* Datos básicos */}
        <Reveal from="up" className="block">
          <PasoSeccion paso="1" titulo="Tus datos" ayuda="Con la fecha de nacimiento calculamos tu edad. El género lo usamos para repartir parejo los partidos mixtos.">
            <div className="space-y-4">
              <div ref={registrarCampo('name')}>
                <Label htmlFor="name">Nombre</Label>
                <Input
                  id="name"
                  data-testid="profile-name-input"
                  disabled={loading}
                  autoComplete="name"
                  aria-invalid={!!errors.name}
                  className={`${INPUT_BASE} ${errors.name ? 'border-red-300' : ''}`}
                  {...register('name')}
                />
                {errors.name && (
                  <p className="mt-1 text-xs text-red-600" data-testid="profile-name-error">{errors.name.message}</p>
                )}
              </div>
              <div ref={registrarCampo('birth_date')}>
                <Label htmlFor="birth_date">Fecha de nacimiento</Label>
                <Input
                  id="birth_date"
                  type="date"
                  data-testid="profile-birthdate-input"
                  disabled={loading}
                  autoComplete="bday"
                  max={todayISO()}
                  aria-invalid={!!errors.birth_date}
                  className={`${INPUT_BASE} ${errors.birth_date ? 'border-red-300' : ''}`}
                  {...register('birth_date')}
                />
                {errors.birth_date && (
                  <p className="mt-1 text-xs text-red-600" data-testid="birthdate-error">{errors.birth_date.message}</p>
                )}
              </div>
              <div ref={registrarCampo('gender')}>
                <Label>Género</Label>
                <p className="mt-1 text-xs text-slate-600">
                  Cuando el partido es mixto, lo usamos para que los dos equipos queden parejos.
                </p>
                <GenderPicker
                  className="mt-2"
                  value={gender}
                  onChange={(id) => setValue('gender', id, { shouldValidate: true })}
                  disabled={loading}
                />
                {errors.gender && (
                  <p className="mt-1 text-xs text-red-600" data-testid="gender-error">{errors.gender.message}</p>
                )}
              </div>
            </div>
          </PasoSeccion>
        </Reveal>

        {/* Posiciones */}
        <Reveal from="up" delay={60} className="block">
          <PasoSeccion paso="2" titulo="Dónde jugás" ayuda="Es lo que usamos para repartir los equipos parejos.">
            {positionsLoading ? (
              <div className="flex items-center gap-2 py-4 text-sm text-slate-600" data-testid="positions-loading">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Cargando posiciones...
              </div>
            ) : positionsError ? (
              <div className="flex flex-col items-center gap-2 rounded-2xl bg-red-50 py-5 text-center" data-testid="positions-error">
                <AlertCircle className="h-5 w-5 text-red-600" aria-hidden="true" />
                <p className="text-sm text-red-600">No pudimos cargar las posiciones.</p>
                <Button
                  type="button"
                  variant="outline"
                  shape="pill"
                  onClick={loadPositions}
                  data-testid="positions-retry-btn"
                  className="h-11 bg-white px-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2"
                >
                  Reintentar
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                <div ref={registrarCampo('primary_position')}>
                  <Label className="text-sm font-semibold">Posición principal</Label>
                  <PositionPicker
                    className="mt-2"
                    ariaLabel="Posición principal"
                    opciones={positions}
                    seleccion={primaryPosition}
                    testIdPrefix="primary-pos"
                    onToggle={selectPrimary}
                    disabled={loading}
                  />
                  {errors.primary_position && (
                    <p className="mt-2 text-xs text-red-600" data-testid="primary-position-error">{errors.primary_position.message}</p>
                  )}
                </div>

                {/* Los dos opcionales van plegados: son el 38% del alto del
                    formulario y ninguno hace falta para jugar. Ver CampoOpcional. */}
                <div className="space-y-3">
                  <CampoOpcional
                    testId="secondary-positions"
                    titulo="¿Jugás en otra posición?"
                    ayuda="Sumá hasta 3. Opcional."
                    resumen={nombresDePosiciones(secondaryPositions)}
                    abierto={verSecundarias}
                    onToggle={() => setVerSecundarias((v) => !v)}
                  >
                    <PositionPicker
                      ariaLabel="Posiciones secundarias"
                      opciones={positions.filter(p => p.id !== primaryPosition)}
                      seleccion={secondaryPositions}
                      testIdPrefix="secondary-pos"
                      onToggle={toggleSecondary}
                      disabled={loading}
                      tono="charcoal"
                    />
                  </CampoOpcional>

                  <CampoOpcional
                    testId="unwanted-position"
                    titulo="¿Hay alguna donde no querés jugar?"
                    ayuda="El organizador va a evitar ponerte ahí. Opcional."
                    resumen={nombresDePosiciones(unwantedPosition)}
                    abierto={verNoDeseada}
                    onToggle={() => setVerNoDeseada((v) => !v)}
                  >
                    <PositionPicker
                      ariaLabel="Posición no deseada"
                      opciones={positions}
                      seleccion={unwantedPosition}
                      testIdPrefix="unwanted-pos"
                      onToggle={toggleUnwanted}
                      disabled={loading}
                      tono="danger"
                      marca="cruz"
                    />
                  </CampoOpcional>
                </div>
              </div>
            )}
          </PasoSeccion>
        </Reveal>
        {/* Foto */}
        <Reveal from="up" delay={120} className="block">
          <PasoSeccion
            paso="3"
            titulo="Tu foto"
            ayuda="Opcional. Ayuda a que tus compañeros te reconozcan en la cancha, y la podés cargar después."
          >
            <div className="flex items-center gap-5">
              <label
                className="group cursor-pointer rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2"
                data-testid="photo-upload-area"
                tabIndex={0}
                role="button"
                aria-label="Subir foto de perfil"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openFilePicker();
                  }
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoChange}
                  data-testid="photo-upload-input"
                />
                <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 transition-colors group-hover:border-turf group-hover:bg-turf/5 motion-reduce:transition-none">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Vista previa de tu foto de perfil" className="h-full w-full object-cover" />
                  ) : (
                    <Camera className="h-8 w-8 text-slate-600 transition-colors group-hover:text-turf-accessible motion-reduce:transition-none" aria-hidden="true" />
                  )}
                </div>
              </label>
              <div className="min-w-0 text-sm text-slate-600">
                <p className="font-semibold text-slate-900">
                  {photoPreview ? 'Buena foto' : 'Subí tu foto'}
                </p>
                <p className="mt-0.5">
                  {photoPreview
                    ? 'Tocá la imagen si querés cambiarla.'
                    : 'Tocá el cuadro y elegí una imagen de hasta 5 MB.'}
                </p>
                {photoPreview && (
                  <button
                    type="button"
                    onClick={quitarFoto}
                    disabled={loading}
                    data-testid="photo-remove-btn"
                    className="-ml-2 mt-1 inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-2 font-semibold text-slate-600 transition-colors hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2 disabled:opacity-50 motion-reduce:transition-none"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                    Quitar foto
                  </button>
                )}
              </div>
            </div>
          </PasoSeccion>
        </Reveal>


        <Button
          type="submit"
          shape="pill"
          data-testid="save-profile-btn"
          disabled={loading || positionsLoading}
          className="h-12 w-full bg-turf-btn text-base text-white shadow-lift-turf hover:bg-turf-btn-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {loading ? 'Guardando...' : 'Guardar y Continuar'}
        </Button>

        <p className="pb-2 text-center text-xs text-slate-600">
          Después podés cambiar todo esto desde tu perfil.
        </p>
      </form>
    </div>
  );
}
