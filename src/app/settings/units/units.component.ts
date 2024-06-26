import { Component, OnInit } from '@angular/core';
import { UntypedFormGroup, UntypedFormControl, FormsModule, ReactiveFormsModule }    from '@angular/forms';
import { AppSettingsService } from '../../core/services/app-settings.service';
import { AppService } from '../../core/services/app-service';
import { IUnitDefaults, UnitsService, IUnit } from '../../core/services/units.service';
import { MatButton } from '@angular/material/button';
import { MatDivider } from '@angular/material/divider';
import { MatOption } from '@angular/material/core';
import { MatSelect } from '@angular/material/select';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { NgFor, KeyValuePipe } from '@angular/common';

@Component({
    selector: 'settings-units',
    templateUrl: './units.component.html',
    styleUrls: ['./units.component.scss'],
    standalone: true,
    imports: [FormsModule, ReactiveFormsModule, NgFor, MatFormField, MatLabel, MatSelect, MatOption, MatDivider, MatButton, KeyValuePipe]
})
export class SettingsUnitsComponent implements OnInit {

  formUnitMaster: UntypedFormGroup;

  groupUnits: {[key: string]: IUnit}[] = [];
  defaultUnits: IUnitDefaults;



  constructor(
    private units: UnitsService,
    private appSettingsService: AppSettingsService,
    private appService: AppService,
    ) { }

  ngOnInit() {

    this.defaultUnits = this.appSettingsService.getDefaultUnits();

    //format unit group data a bit better for consumption in template
    let unitGroupsRaw = this.units.getConversions();

    for (let gindex = 0; gindex < unitGroupsRaw.length; gindex++) {
      const unitGroup = unitGroupsRaw[gindex];
      let units = [];

      for (let index = 0; index < unitGroup.units.length; index++) {
        const unit = unitGroup.units[index];
        units.push(unit);
      }
      this.groupUnits[unitGroup.group] = units;
    }

    //generate formGroup
    let groups = new UntypedFormGroup({});
    Object.keys(this.defaultUnits).forEach(key => {
      groups.addControl(key, new UntypedFormControl(this.defaultUnits[key]));
    });

    this.formUnitMaster = groups;
    this.formUnitMaster.updateValueAndValidity();
    //console.log(this.formUnitMaster);
  }

  submitConfig() {
    this.appSettingsService.setDefaultUnits(this.formUnitMaster.value);
    this.appService.sendSnackbarNotification("Default units configuration saved", 5000, false);
  }

}
