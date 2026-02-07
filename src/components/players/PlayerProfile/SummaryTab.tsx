import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import type { Player } from "@/lib/types";

export function SummaryTab({ player }: { player: Player }) {

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
                            <TableRow>
                                <TableCell className="font-medium text-muted-foreground">Categoría</TableCell>
                                <TableCell className="text-right">{player.categoryId}</TableCell>
                            </TableRow>
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
