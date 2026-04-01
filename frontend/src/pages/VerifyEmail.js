import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Trophy } from 'lucide-react';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token');

  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('Verificando tu cuenta...');

  useEffect(() => {
    const run = async () => {
      if (!token) {
        setStatus('error');
        setMessage('Falta el token de verificación');
        return;
      }

      try {
        const res = await api.get(`/auth/verify-email?token=${encodeURIComponent(token)}`);
        setStatus('success');
        setMessage(res.data?.message || 'Cuenta verificada correctamente');
      } catch (err) {
        setStatus('error');
        setMessage(err.response?.data?.detail || 'No se pudo verificar la cuenta');
      }
    };

    run();
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md animate-slide-up">
        <div className="flex justify-center mb-8">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-turf rounded-xl flex items-center justify-center">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <span className="font-heading text-2xl font-bold uppercase tracking-tight">App Futbol</span>
          </Link>
        </div>

        <Card className="border-slate-100 shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="font-heading text-2xl uppercase tracking-tight text-center">
              {status === 'loading' ? 'Verificando...' : status === 'success' ? 'Cuenta verificada' : 'Error de verificación'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className={status === 'success' ? 'text-slate-700' : 'text-red-600'}>
              {message}
            </p>

            <Link to="/login">
              <Button className="w-full h-12 bg-turf hover:bg-turf-dark text-white rounded-xl font-bold uppercase tracking-wider text-sm">
                Ir a iniciar sesión
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}