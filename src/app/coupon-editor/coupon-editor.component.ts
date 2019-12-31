import { Component } from "@angular/core";
import {
  FormBuilder,
  FormGroup,
  Validators,
  FormControl
} from "@angular/forms";
import {
  BehaviorSubject,
  combineLatest,
  interval,
  merge,
  Observable,
  of,
  Subject,
  Subscription
} from "rxjs";
import { withLatestFrom, map, filter } from "rxjs/operators";

@Component({
  selector: "app-coupon-editor",
  templateUrl: "./coupon-editor.component.html",
  styleUrls: ["./coupon-editor.component.scss"]
})
export class CouponEditorComponent {
  coupon$ = new Subject<Coupon>();
  //selection: Coupon;
  couponList$ = new BehaviorSubject<Array<Coupon>>([new Coupon(new Date(), "A", "Z"), new Coupon(new Date(), "A", "R")]);
  renderedList$ = new BehaviorSubject<Array<Coupon>>([]);
  formGroup: FormGroup;
  formGroupData$: Observable<FormGroupData>;
  itemGroupData: ItemGroupData;
  sort$ = new BehaviorSubject<SortType>(SortType.Asc);
  buttonAction$ = new Subject<ButtonActionType>();
  checkBoxAction$ = new Subject<ItemType>();
  sub: Subscription = new Subscription();
  sortType = SortType;
  buttonActionType = ButtonActionType;
  itemType = ItemType;
  displayedColumns: string[] = ['name'];
  
  currentList: Array<Coupon>;

  constructor(private formBuilder: FormBuilder) {
    this.processRendering();
    this.processDeletion();
    this.processCreation();
    this.processSaving();

    this.sub.add(this.couponList$.subscribe(v => (this.currentList = v)));
  }

  // rendering managment

  private processRendering() {
    this.initializeForms();

    this.sub.add(
      combineLatest([this.sort$, this.couponList$]).subscribe(
        ([sort, list]) => {
          const asc = sort === SortType.Asc;
          const l = list.sort((a, b) => (asc ? a : b).date.getTime() - (asc ? b : a).date.getTime());
          this.renderedList$.next([...l]);
          this.coupon$.next(l.length > 0 ? l[0] : new Coupon());
        })
    );

    this.sub.add(
      this.coupon$.subscribe(coupon => {
        this.formGroup.reset();
        this.formGroup.patchValue(this.convertToFormGroupData(coupon), {emitEvent: false})
      })
    );

    this.sub.add(this.checkBoxAction$.subscribe( type => {
      const date = this.formGroup.value[type];
      this.formGroup.patchValue({ [type]: date ? null : new Date() }, {emitEvent: false});
    }))
  }

  // // buttons actions managment

  private processSaving() {
    this.sub.add(
      this.buttonAction$
        .pipe(
          filter(action => action === ButtonActionType.Save),
          withLatestFrom(this.formGroupData$))
        .subscribe(([_, formGroupData]) => {
          const coupon = this.convertToCoupon(formGroupData as FormGroupData);
          this.currentList.push(coupon);
          this.couponList$.next([...this.currentList]);
        })
    );
  }

  private processCreation() {
    this.sub.add(
      this.buttonAction$
        .pipe(filter(action => action === ButtonActionType.Create))
        .subscribe(_ => this.coupon$.next(new Coupon()))
    );
  }

  private processDeletion() {
    this.sub.add(
      this.buttonAction$.pipe(
          filter(action => action === ButtonActionType.Delete),
          withLatestFrom(this.coupon$))
        .subscribe(([_, toDelete]) => {
          const newsList = this.currentList.filter(coupon => coupon.id !== toDelete.id);
          this.couponList$.next(newsList);
        })
    );
  }

  // helpers

  private convertToFormGroupData(coupon: Coupon): FormGroupData {
    return new FormGroupData(coupon.name, coupon.code, coupon.percent, coupon.duration, coupon.fromDate, coupon.toDate
    );
  }

  private convertToCoupon(data: FormGroupData): Coupon {
    const uuid = new Date().toString();
    return new Coupon(new Date(), uuid, data.name, data.code, data.percent, data.duration, data.fromDate,data.toDate
    );
  }

  private initializeForms() {
    const data = new FormGroupData();
    this.formGroup = this.formBuilder.group(
      {
        name: [data.name, Validators.required],
        code: [data.code, Validators.required],
        fromDate: [data.fromDate],
        toDate: [data.toDate],
        percent: [
          data.percent,
          [Validators.required, Validators.min(0), Validators.max(100)]
        ],
        duration: [
          data.duration,
          [Validators.required, Validators.min(0), Validators.min(0)]
        ]
      }, { emitEvent: false }
    );

    this.itemGroupData = new ItemGroupData(
      [
        new CouponIdentityItem(ItemType.Name, "Libellé de l'offre"),
        new CouponIdentityItem(ItemType.Code, "Code promotionnel")
      ],
      [
        new CouponValidityItem(ItemType.FromDate, "Période de validité", "Choisir une date", "Début"),
        new CouponValidityItem(
          ItemType.ToDate,
          "",
          "Choisir une date",
          "Fin"
        )
      ],
      [
        new CouponParamItem(
          ItemType.Percent,
          "Réduction",
          "Pourcentage",
          "%"
        ),
        new CouponParamItem(ItemType.Duration, "Durée", "Nombre", "mois")
      ]
    );

    this.formGroupData$ = this.formGroup.valueChanges;
  }
}

enum SortType {
  Asc = "asc",
  Desc = "desc",
}

enum ButtonActionType {
  Delete = "Delete",
  Create = "Create",
  Save = "Save"
}

enum ItemType {
  Name = "name",
  Code = "code",
  FromDate = "fromDate",
  ToDate = "toDate",
  Percent = "percent",
  Duration = "duration"
}

class Coupon {
  constructor(
    public date = new Date(),
    public id?: string,
    public name?: string,
    public code?: string,
    public percent?: number,
    public duration?: number,
    public fromDate?: Date,
    public toDate?: Date
  ) {}
}

class FormGroupData {
  constructor(
    public name?: string,
    public code?: string,
    public percent?: number,
    public duration?: number,
    public fromDate?: Date,
    public toDate?: Date
  ) {}
}

class ItemGroupData {
  constructor(
    public identityItemList: CouponIdentityItem[],
    public validityItemList: CouponValidityItem[],
    public paramItemList: CouponParamItem[]
  ) {}
}

class CouponIdentityItem {
  constructor(public type: ItemType, public hint: string) {}
}

class CouponValidityItem {
  constructor(
    public type: ItemType,
    public title: string,
    public hint: string,
    public subtitle: string
  ) {}
}

class CouponParamItem {
  constructor(
    public type: ItemType,
    public title: string,
    public hint: string,
    public unit: string
  ) {}
}


