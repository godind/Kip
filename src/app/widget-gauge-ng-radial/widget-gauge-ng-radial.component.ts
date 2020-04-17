import { ViewChild, ElementRef, Component, Input, OnInit, OnDestroy, AfterContentInit, AfterContentChecked } from '@angular/core';
import { Subscription } from 'rxjs';
import { MatDialog } from '@angular/material';

import { SignalKService } from '../signalk.service';
import { ModalWidgetComponent } from '../modal-widget/modal-widget.component';
import { WidgetManagerService, IWidget, IWidgetConfig } from '../widget-manager.service';
import { UnitsService } from '../units.service';
import { AppSettingsService } from '../app-settings.service';
import { RadialGauge, RadialGaugeOptions } from 'ng-canvas-gauges';

const defaultConfig: IWidgetConfig = {
  widgetLabel: null,
  paths: {
    "gaugePath": {
      description: "Numeric Data",
      path: null,
      source: null,
      pathType: "number",
    }
  },
  units: {
    "gaugePath": "unitless"
  },
  selfPaths: true,

  gaugeType: 'ngRadial',  //ngLinearVertical or ngLinearHorizontal
  gaugeTicks: false,
  minValue: 0,
  maxValue: 100,
  numInt: 1,
  numDecimal: 0,
  barColor: 'accent',     // theme palette to select
};

@Component({
  selector: 'app-widget-gauge-ng-radial',
  templateUrl: './widget-gauge-ng-radial.component.html',
  styleUrls: ['./widget-gauge-ng-radial.component.scss']
})
export class WidgetGaugeNgRadialComponent implements OnInit, OnDestroy, AfterContentInit, AfterContentChecked {

  @ViewChild('wrapperDiv') wrapper: ElementRef;
  @ViewChild('radialGauge') public radialGauge: RadialGauge;

  @Input('widgetUUID') widgetUUID: string;
  @Input('unlockStatus') unlockStatus: boolean;

  // hack to access material-theme palette colors
  @ViewChild('primary') primaryElement: ElementRef;
  @ViewChild('accent') accentElement: ElementRef;
  @ViewChild('warn') warnElement: ElementRef;
  @ViewChild('background') backgroundElement: ElementRef;
  @ViewChild('text') textElement: ElementRef;

  activeWidget: IWidget;
  config: IWidgetConfig;

  public dataValue = 0;
  valueSub: Subscription = null;

  // dynamics theme support
  themeNameSub: Subscription = null;


  themePrimaryColor: string;
  themeAccentColor: string;
  themeWarnColor: string;
  themeBackgroundColor: string;
  themeTextColor: string;

  public gaugeOptions = {} as RadialGaugeOptions;

  constructor(
    public dialog:MatDialog,
    private SignalKService: SignalKService,
    private WidgetManagerService: WidgetManagerService,
    private UnitsService: UnitsService,
    private AppSettingsService: AppSettingsService, // need for theme change subscription
  ) { }

  ngOnInit() {
    this.activeWidget = this.WidgetManagerService.getWidget(this.widgetUUID);
    if (this.activeWidget.config === null) {
        // no data, let's set some!
      this.WidgetManagerService.updateWidgetConfig(this.widgetUUID, defaultConfig);
      this.config = defaultConfig; // load default config.
    } else {
      this.config = this.activeWidget.config;
    }
    this.subscribePath();
    this.subscribeTheme();
  }

  ngOnDestroy() {
    this.unsubscribeTheme();
    this.unsubscribePath();
  }

  ngAfterContentInit() {
    this.updateGaugeConfig();
  }

  ngAfterContentChecked() {
    this.resizeWidget();
   }

  subscribePath() {
    this.unsubscribePath();
    if (typeof(this.config.paths['gaugePath'].path) != 'string') { return } // nothing to sub to...

    this.valueSub = this.SignalKService.subscribePath(this.widgetUUID, this.config.paths['gaugePath'].path, this.config.paths['gaugePath'].source).subscribe(
      newValue => {
        this.dataValue = this.UnitsService.convertUnit(this.config.units['gaugePath'], newValue);

        // Limit gauge progressbar overflow
        if (this.dataValue >= this.config.maxValue) {
          this.dataValue = this.config.maxValue;
        };
        if (this.dataValue <= this.config.minValue) {
          this.dataValue = this.config.minValue;
        };
      }
    );
  }

  unsubscribePath() {
    if (this.valueSub !== null) {
      this.valueSub.unsubscribe();
      this.valueSub = null;
      this.SignalKService.unsubscribePath(this.widgetUUID, this.config.paths['gaugePath'].path)
    }
  }

   // Subscribe to theme event
   subscribeTheme() {
    this.themeNameSub = this.AppSettingsService.getThemeNameAsO().subscribe(
      themeChange => {
       setTimeout(() => {   // need a delay so browser getComputedStyles has time to complete theme application.
        this.updateGaugeConfig();
       }, 50);
    })
  }

  unsubscribeTheme(){
    if (this.themeNameSub !== null) {
      this.themeNameSub.unsubscribe();
      this.themeNameSub = null;
    }
  }

  openWidgetSettings() {
    let dialogRef = this.dialog.open(ModalWidgetComponent, {
      width: '80%',
      data: this.config
    });

    dialogRef.afterClosed().subscribe(result => {
      // save new settings
      if (result) {
        console.log(result);
        this.unsubscribePath();  //unsub now as we will change variables so wont know what was subbed before...
        this.config = result;
        this.WidgetManagerService.updateWidgetConfig(this.widgetUUID, this.config);
        this.subscribePath();
        this.updateGaugeConfig();
      }
    });
  }

  updateGaugeConfig(){
    ////  Colors
    // Hack to get mixin theme colors using hidden DIV and @ViewChild - Don't know of a better way to access material theme in TS
    this.themePrimaryColor = getComputedStyle(this.primaryElement.nativeElement).color;
    this.themeAccentColor = getComputedStyle(this.accentElement.nativeElement).color;
    this.themeWarnColor = getComputedStyle(this.warnElement.nativeElement).color;
    this.themeBackgroundColor = getComputedStyle(this.backgroundElement.nativeElement).color;
    this.themeTextColor = getComputedStyle(this.textElement.nativeElement).color;

    // Labels to match selected theme
    this.gaugeOptions.colorTitle = this.gaugeOptions.colorUnits = this.gaugeOptions.colorValueText = this.themeTextColor;

    // Face plate and gauge bar background - match selected theme
    this.gaugeOptions.colorPlate = window.getComputedStyle(this.wrapper.nativeElement).backgroundColor;
    this.gaugeOptions.colorBar = this.themeBackgroundColor;

    ///////////////////////////////////////
    //Set gauge layout selection specific values

    this.gaugeOptions.valueInt = this.config.numInt;
    this.gaugeOptions.valueDec = this.config.numDecimal;

    if (this.config.gaugeTicks == true) {
      this.gaugeOptions.majorTicks = [0,100];
      this.gaugeOptions.majorTicksInt = 1;
      this.gaugeOptions.colorMajorTicks = "red";
      this.gaugeOptions.minorTicks = 10;
      this.gaugeOptions.colorMinorTicks = this.gaugeOptions.colorTitle;
      this.gaugeOptions.numbersMargin = -20;
      this.gaugeOptions.fontNumbersSize = 25;
      this.gaugeOptions.colorNumbers = this.gaugeOptions.colorTitle;
    }
    else {
      this.gaugeOptions.majorTicks = [];
      this.gaugeOptions.majorTicksInt = 0;
      this.gaugeOptions.colorMajorTicks = "";
      this.gaugeOptions.minorTicks = 0;
      this.gaugeOptions.colorMinorTicks = "";
      this.gaugeOptions.numbersMargin = 0;
      this.gaugeOptions.fontNumbersSize = 0;
    }

    switch (this.config.barColor) {
      case "primary":
        this.gaugeOptions.colorBarProgress = this.themePrimaryColor;
        break;

      case "accent":
        this.gaugeOptions.colorBarProgress = this.themeAccentColor;
        break;

      case "warn":
        this.gaugeOptions.colorBarProgress = this.themeWarnColor;
        break;

      case "special":
        this.gaugeOptions.colorBarProgress = "red";
        break;

      default:
        break;
    }
  }

  resizeWidget() {
    let rect = this.wrapper.nativeElement.getBoundingClientRect();

    this.gaugeOptions.height = Math.floor(rect.height * 0.88);
    this.gaugeOptions.width = Math.floor(rect.width * 0.88);
  }
}
