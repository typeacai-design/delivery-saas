'use client'

import { useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { Map, Marker, MapMouseEvent } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

type Coordinates = { latitude?: number | null; longitude?: number | null }

export function CoordinateMap({value,onChange}:{value?:Coordinates;onChange:(value:{latitude:number;longitude:number})=>void}){
  const host=useRef<HTMLDivElement>(null),map=useRef<Map|null>(null),marker=useRef<Marker|null>(null)
  const [initialCoordinates] = useState(() => ({ longitude: Number.isFinite(Number(value?.longitude)) ? Number(value?.longitude) : -38.54, latitude: Number.isFinite(Number(value?.latitude)) ? Number(value?.latitude) : -3.73 }))
  const change=useRef(onChange)
  useEffect(()=>{ change.current=onChange },[onChange])
  useEffect(()=>{
    if(!host.current||map.current)return
    const { longitude, latitude } = initialCoordinates
    const instance=new maplibregl.Map({container:host.current,center:[longitude,latitude],zoom:14,style:{version:8,sources:{osm:{type:'raster',tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,attribution:'© OpenStreetMap'}},layers:[{id:'osm',type:'raster',source:'osm'}]}})
    instance.addControl(new maplibregl.NavigationControl({showCompass:false}),'top-right')
    const pin=new maplibregl.Marker({draggable:true}).setLngLat([longitude,latitude]).addTo(instance)
    pin.on('dragend',()=>{const p=pin.getLngLat();change.current({longitude:Number(p.lng.toFixed(6)),latitude:Number(p.lat.toFixed(6))})})
    instance.on('click',(e: MapMouseEvent)=>{pin.setLngLat(e.lngLat);change.current({longitude:Number(e.lngLat.lng.toFixed(6)),latitude:Number(e.lngLat.lat.toFixed(6))})})
    map.current=instance;marker.current=pin
    return()=>{instance.remove();map.current=null;marker.current=null}
  },[initialCoordinates])
  useEffect(()=>{const lng=Number(value?.longitude),lat=Number(value?.latitude);if(marker.current&&Number.isFinite(lng)&&Number.isFinite(lat)){marker.current.setLngLat([lng,lat]);map.current?.easeTo({center:[lng,lat]})}},[value?.latitude,value?.longitude])
  return <div><div ref={host} className="h-56 rounded-2xl border overflow-hidden"/><p className="mt-1 text-xs text-gray-500">Arraste o marcador ou clique no mapa · {value?.latitude??'—'}, {value?.longitude??'—'}</p></div>
}
