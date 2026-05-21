/**
 * Component barrel — import everything from one place.
 *
 * Usage in pages:
 *   import { InputComponent, ButtonComponent, DataTableComponent } from '../components';
 */

// Base
export { BaseComponent }         from './base/BaseComponent';
export type { LocatorStrategy }  from './base/BaseComponent';

// Form
export { InputComponent }        from './form/InputComponent';
export { ButtonComponent }       from './form/ButtonComponent';
export { DropdownComponent }     from './form/DropdownComponent';
export { CheckboxComponent }     from './form/CheckboxComponent';
export { FormComponent }         from './form/FormComponent';

// Data
export { DataTableComponent }    from './data/DataTableComponent';
export type { RowData }          from './data/DataTableComponent';
export { PaginationComponent }   from './data/PaginationComponent';
export { SearchComponent }       from './data/SearchComponent';

// Feedback
export { AlertComponent }        from './feedback/AlertComponent';
export { ToastComponent }        from './feedback/ToastComponent';
export { ModalComponent }        from './feedback/ModalComponent';

// Navigation
export { NavBarComponent }       from './navigation/NavBarComponent';
export { SideBarComponent }      from './navigation/SideBarComponent';
