import React from 'react';
import { Filter, Search, UserCheck, UserPlus, Users } from 'lucide-react';

import GroupMemberCard from '@/components/groups/GroupMemberCard';
import SectionPanel from '@/components/groups/SectionPanel';
import EmptyState from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * Panel del plantel del grupo: buscador, filtro y lista de personas.
 *
 * Es presentacion pura: el filtrado, los permisos y las acciones viven en
 * GroupDetail y entran por props.
 */
export default function GroupMembersPanel({
  members,
  filteredMembers,
  filterOptions,
  search,
  onSearchChange,
  filter,
  onFilterChange,
  onClearFilters,
  canInvite,
  canManage,
  myProfileId,
  guestCount,
  memberActionLoading,
  onRemoveMember,
  onLinkGuest,
}) {
  const totalFrecuentes = members.filter((m) => m.membership_type === 'frecuente').length;
  const totalInvitados = members.filter((m) => m.membership_type === 'invitado').length;

  return (
    <SectionPanel
      icono={Users}
      titulo="Plantel del grupo"
      descripcion="Tocá la foto para verla más grande."
      aside={
        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
          <Filter className="h-3.5 w-3.5" aria-hidden="true" />
          {filteredMembers.length} visibles
        </span>
      }
      contentClassName="space-y-4"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_190px]">
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600"
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por nombre, email o posición"
            aria-label="Buscar miembros por nombre, email o posición"
            className="h-12 rounded-xl border-slate-200 bg-slate-50 pl-9 focus:border-turf focus:ring-2 focus:ring-turf/20"
            data-testid="group-member-search"
          />
        </div>
        <Select value={filter} onValueChange={onFilterChange}>
          <SelectTrigger
            className="h-12 rounded-xl border-slate-200 bg-slate-50 focus:border-turf focus:ring-2 focus:ring-turf/20"
            aria-label="Filtrar miembros"
            data-testid="group-member-filter"
          >
            <SelectValue placeholder="Filtrar" />
          </SelectTrigger>
          <SelectContent>
            {filterOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {members.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-4 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-turf/25 bg-turf/10 px-2.5 py-1 font-semibold text-turf-accessible">
            <UserCheck className="h-3 w-3" aria-hidden="true" /> {totalFrecuentes} frecuentes
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-orange/45 bg-orange/10 px-2.5 py-1 font-semibold text-orange-accessible">
            <UserPlus className="h-3 w-3" aria-hidden="true" /> {totalInvitados} invitados
          </span>
          <span className="text-slate-600">
            El borde punteado marca a los invitados.
          </span>
        </div>
      )}

      {filteredMembers.length === 0 ? (
        members.length === 0 ? (
          <EmptyState
            variante={2}
            icono={Users}
            titulo="Todavía no hay nadie"
            descripcion={
              canInvite
                ? 'Sumá al primero desde el panel “Sumar jugador”: alcanza con el nombre.'
                : 'Cuando el organizador sume gente al grupo, la vas a ver acá.'
            }
            testId="group-members-empty"
          />
        ) : (
          <EmptyState
            variante={3}
            icono={Search}
            titulo="Sin resultados"
            descripcion="No encontramos a nadie con esa búsqueda o ese filtro."
            accion={
              <Button
                type="button"
                onClick={onClearFilters}
                shape="pill"
                className="h-12 bg-white px-6 text-slate-900 hover:bg-slate-100"
                data-testid="group-clear-filters"
              >
                Limpiar filtros
              </Button>
            }
            testId="group-members-empty"
          />
        )
      ) : (
        <ul className="space-y-3">
          {filteredMembers.map((member) => (
            <li
              key={member.id}
              className={
                memberActionLoading === member.id
                  ? 'pointer-events-none opacity-60 transition-opacity motion-reduce:transition-none'
                  : 'transition-opacity motion-reduce:transition-none'
              }
              aria-busy={memberActionLoading === member.id}
            >
              <GroupMemberCard
                member={member}
                canManage={canManage}
                canRemove={member.player_id !== myProfileId}
                onRemove={() => onRemoveMember(member)}
                onLinkGuest={
                  canManage && member.membership_type !== 'invitado' && guestCount > 0
                    ? () => onLinkGuest(member)
                    : undefined
                }
              />
            </li>
          ))}
        </ul>
      )}
    </SectionPanel>
  );
}
