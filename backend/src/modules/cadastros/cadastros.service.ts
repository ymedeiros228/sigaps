import { Injectable } from '@nestjs/common';
import { MunicipalitiesService } from '../municipalities/municipalities.service';
import { MicroareasService } from '../microareas/microareas.service';
import { AcsService } from '../acs/acs.service';
import { UbsService } from '../ubs/ubs.service';
import { NeighborhoodsService } from '../neighborhoods/neighborhoods.service';
import type { AuthViewer } from '../../common/utils/acs-scope.util';

@Injectable()
export class CadastrosService {
  constructor(
    private readonly municipalities: MunicipalitiesService,
    private readonly microareas: MicroareasService,
    private readonly acs: AcsService,
    private readonly ubs: UbsService,
    private readonly neighborhoods: NeighborhoodsService,
  ) {}

  /** Um único request com tudo que a tela Cadastros precisa. */
  getMunicipalityBundle(
    municipalityId: string,
    viewer?: AuthViewer,
    viewerRole?: string,
  ) {
    return Promise.all([
      this.municipalities.findOne(municipalityId),
      this.municipalities.getCadastrosSummary(municipalityId),
      this.microareas.findByMunicipality(municipalityId, viewer),
      this.ubs.findByMunicipality(municipalityId),
      this.acs.findByMunicipality(municipalityId, viewerRole),
      this.neighborhoods.findByMunicipality(municipalityId),
    ]).then(([municipality, summary, microareas, ubs, acs, neighborhoods]) => ({
      municipality,
      summary,
      microareas,
      ubs,
      acs,
      neighborhoods,
    }));
  }
}
