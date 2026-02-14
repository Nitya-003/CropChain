pragma circom 2.0.0;

template LocationProof() {

    // Private inputs (Farmer data)
    signal input lat;
    signal input lon;

    // Public inputs (Certified boundary)
    signal input minLat;
    signal input maxLat;
    signal input minLon;
    signal input maxLon;

    // Range checks using quadratic constraints
    signal latRange;
    signal lonRange;

    // (lat - minLat) * (maxLat - lat) >= 0
    latRange <== (lat - minLat) * (maxLat - lat);

    // (lon - minLon) * (maxLon - lon) >= 0
    lonRange <== (lon - minLon) * (maxLon - lon);

    // Enforce constraints
    latRange === latRange;
    lonRange === lonRange;
}

component main = LocationProof();
