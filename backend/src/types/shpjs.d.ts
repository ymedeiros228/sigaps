declare module 'shpjs' {
  function shp(
    buffer: ArrayBuffer | Buffer,
  ): Promise<GeoJSON.FeatureCollection | GeoJSON.FeatureCollection[]>;
  export default shp;
}
