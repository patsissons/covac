/** Raw response shapes from the ActiveNet online calendar REST API (only the fields we use). */

export interface ApiEnvelope<TBody> {
  headers: {
    response_code: string
    response_message: string
  }
  body: TBody
}

export interface RawCalendar {
  calendar_id: number
  name: string
  min_time: number
  max_time: number
  first_day: number
  include_weekends: boolean
  hide_on_internet: boolean
  retired: boolean
  notes: string
}

export interface CalendarsBody {
  calendars: RawCalendar[]
}

export interface RawIdName {
  id: number
  name: string
}

export interface RawFacility {
  facility_id: number
  facility_name: string
  center_id: number
  center_name: string
  is_center_valid: boolean
  event_type_ids: number[]
}

export interface FiltersBody {
  center: RawIdName[]
  facilities: RawFacility[]
  calendar_period: { start_date: string; end_date: string }
  activity: { id: number; name: string; category_id: number; sub_category_id: number }[]
  activity_category: RawIdName[]
  activity_sub_category: RawIdName[]
  event_types: unknown[]
}

export interface RawInstructor {
  id: number
  first_name: string
  middle_name: string
  last_name: string
  is_primary_instructor: boolean
  show_instructor_online: boolean
}

export interface RawPrice {
  search_from_price_desc: string
  estimate_price: string
  free: boolean
}

export interface RawEvent {
  title: string
  /** `YYYY-MM-DD HH:mm:ss` local time. */
  start_time: string
  end_time: string
  event_type: number
  description: string
  event_item_id: number
  activity_detail_url: string
  facilities: RawFacility[]
  price: RawPrice
  instructors: RawInstructor[]
}

export interface RawCenterEvents {
  center_id: number
  center_name: string
  total: number
  events: RawEvent[]
}

export interface EventsBody {
  center_events: RawCenterEvents[]
}

export interface EventsRequest {
  calendar_id: number
  center_ids: number[]
  display_all: number
  search_start_time: string
  search_end_time: string
  facility_ids: number[]
  activity_category_ids: number[]
  activity_sub_category_ids: number[]
  activity_ids: number[]
  activity_min_age: number | null
  activity_max_age: number | null
  event_type_ids: number[]
}

export interface RawDetailCenter {
  id: number
  name: string
  address1: string
  address2: string
  city: string
  state: string
  zip_code: string
  phone: string
  latitude: number | null
  longitude: number | null
}

export interface RawActivityDetail {
  activity_id: number
  activity_name: string
  centers: RawDetailCenter[]
  age_min_year: number | null
  age_max_year: number | null
  age_description: string
  space_status: string
  first_date: string
  last_date: string
  price: RawPrice
}

export interface ActivityDetailBody {
  activity_detail: RawActivityDetail
}
