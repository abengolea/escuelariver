import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import type { Player } from "@/lib/types";

const POSICION_LABELS: Record<string, string> = {
  delantero: "Delantero",
  mediocampo: "Mediocampo",
  defensor: "Defensor",
  arquero: "Arquero",
};

const PIE_LABELS: Record<string, string> = {
  derecho: "Derecho",
  izquierdo: "Izquierdo",
  ambidiestro: "Ambidiestro",
};

export function SummaryTab({ player }: { player: Player }) {
    const hasDeportivo = player.posicion_preferida || player.pie_dominante || player.altura_cm || player.peso_kg;

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline">Información Clave</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableBody>
                            <TableRow>
                                <TableCell className="font-medium text-muted-foreground">Nombre Completo</TableCell>
                                <TableCell className="text-right">{player.firstName} {player.lastName}</TableCell>
                            </TableRow>
                            {player.dni && (
                                <TableRow>
                                    <TableCell className="font-medium text-muted-foreground">DNI</TableCell>
                                    <TableCell className="text-right">{player.dni}</TableCell>
                                </TableRow>
                            )}
                            {player.healthInsurance && (
                                <TableRow>
                                    <TableCell className="font-medium text-muted-foreground">Obra Social</TableCell>
                                    <TableCell className="text-right">{player.healthInsurance}</TableCell>
                                </TableRow>
                            )}
                            {player.email && (
                                <TableRow>
                                    <TableCell className="font-medium text-muted-foreground">Email (acceso al panel)</TableCell>
                                    <TableCell className="text-right">{player.email}</TableCell>
                                </TableRow>
                            )}
                             <TableRow>
                                <TableCell className="font-medium text-muted-foreground">Estado</TableCell>
                                <TableCell className="text-right capitalize">{player.status === 'active' ? 'Activo' : 'Inactivo'}</TableCell>
                            </TableRow>
                             <TableRow>
                                <TableCell className="font-medium text-muted-foreground">Contacto Tutor</TableCell>
                                <TableCell className="text-right">{player.tutorContact.name} ({player.tutorContact.phone})</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
            {hasDeportivo && (
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline">Perfil deportivo</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableBody>
                            {player.posicion_preferida && (
                                <TableRow>
                                    <TableCell className="font-medium text-muted-foreground">Posición</TableCell>
                                    <TableCell className="text-right">{POSICION_LABELS[player.posicion_preferida] || player.posicion_preferida}</TableCell>
                                </TableRow>
                            )}
                            {player.pie_dominante && (
                                <TableRow>
                                    <TableCell className="font-medium text-muted-foreground">Pie predominante</TableCell>
                                    <TableCell className="text-right">{PIE_LABELS[player.pie_dominante] || player.pie_dominante}</TableCell>
                                </TableRow>
                            )}
                            {player.altura_cm != null && (
                                <TableRow>
                                    <TableCell className="font-medium text-muted-foreground">Altura</TableCell>
                                    <TableCell className="text-right">{player.altura_cm} cm</TableCell>
                                </TableRow>
                            )}
                            {player.peso_kg != null && (
                                <TableRow>
                                    <TableCell className="font-medium text-muted-foreground">Peso</TableCell>
                                    <TableCell className="text-right">{player.peso_kg} kg</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
            )}
             <Card className="lg:col-span-2">
                <CardHeader>
                    <CardTitle className="font-headline">Observaciones del Entrenador</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground italic">
                        {player.observations || "No hay observaciones registradas para este jugador."}
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
