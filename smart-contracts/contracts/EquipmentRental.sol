// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title EquipmentRental
 * @dev A decentralized P2P sharing module allowing farmers to rent equipment 
 *      (tractors, harvesters) from nearby peers securely using escrowed deposits.
 */
contract EquipmentRental {
    
    enum RentalStatus { Created, Active, Completed, Disputed, Canceled }

    struct Equipment {
        uint256 id;
        address payable owner;
        string name;
        uint256 pricePerDay;
        uint256 securityDeposit;
        bool isAvailable;
    }

    struct RentalAgreement {
        uint256 id;
        uint256 equipmentId;
        address payable renter;
        uint256 startTime;
        uint256 endTime;
        uint256 totalCost;
        uint256 depositHeld;
        RentalStatus status;
    }

    uint256 public equipmentCounter;
    uint256 public rentalCounter;
    
    // Platform fee configuration
    uint256 public platformFeePercent = 2;
    address payable public platformTreasury;

    mapping(uint256 => Equipment) public equipments;
    mapping(uint256 => RentalAgreement) public rentals;

    event EquipmentListed(uint256 indexed equipmentId, address indexed owner, string name, uint256 pricePerDay);
    event RentalInitiated(uint256 indexed rentalId, uint256 indexed equipmentId, address indexed renter);
    event RentalCompleted(uint256 indexed rentalId);
    event DisputeRaised(uint256 indexed rentalId);

    modifier onlyOwner(uint256 _equipmentId) {
        require(equipments[_equipmentId].owner == msg.sender, "Not the equipment owner");
        _;
    }

    modifier onlyRenter(uint256 _rentalId) {
        require(rentals[_rentalId].renter == msg.sender, "Not the renter");
        _;
    }

    constructor(address payable _treasury) {
        platformTreasury = _treasury;
    }

    /**
     * @dev List a new piece of farming equipment on the P2P marketplace.
     */
    function listEquipment(
        string memory _name, 
        uint256 _pricePerDay, 
        uint256 _securityDeposit
    ) external {
        equipmentCounter++;
        equipments[equipmentCounter] = Equipment({
            id: equipmentCounter,
            owner: payable(msg.sender),
            name: _name,
            pricePerDay: _pricePerDay,
            securityDeposit: _securityDeposit,
            isAvailable: true
        });

        emit EquipmentListed(equipmentCounter, msg.sender, _name, _pricePerDay);
    }

    /**
     * @dev Initiate a rental by locking the rental cost + security deposit in escrow.
     */
    function initiateRental(uint256 _equipmentId, uint256 _rentalDays) external payable {
        Equipment storage eq = equipments[_equipmentId];
        require(eq.isAvailable, "Equipment is not available");
        
        uint256 totalCost = eq.pricePerDay * _rentalDays;
        uint256 requiredValue = totalCost + eq.securityDeposit;
        
        require(msg.value >= requiredValue, "Insufficient funds for rental + deposit");

        eq.isAvailable = false; // Lock the equipment

        rentalCounter++;
        rentals[rentalCounter] = RentalAgreement({
            id: rentalCounter,
            equipmentId: _equipmentId,
            renter: payable(msg.sender),
            startTime: block.timestamp,
            endTime: block.timestamp + (_rentalDays * 1 days),
            totalCost: totalCost,
            depositHeld: eq.securityDeposit,
            status: RentalStatus.Active
        });

        emit RentalInitiated(rentalCounter, _equipmentId, msg.sender);
    }

    /**
     * @dev Renter confirms safe return of equipment. Funds are released.
     */
    function completeRental(uint256 _rentalId) external onlyRenter(_rentalId) {
        RentalAgreement storage rental = rentals[_rentalId];
        require(rental.status == RentalStatus.Active, "Rental is not active");
        
        Equipment storage eq = equipments[rental.equipmentId];

        rental.status = RentalStatus.Completed;
        eq.isAvailable = true;

        // Calculate fees and payouts
        uint256 fee = (rental.totalCost * platformFeePercent) / 100;
        uint256 ownerPayout = rental.totalCost - fee;

        // 1. Transfer rental payment to owner
        eq.owner.transfer(ownerPayout);
        // 2. Transfer platform fee to treasury
        platformTreasury.transfer(fee);
        // 3. Return security deposit to the renter
        rental.renter.transfer(rental.depositHeld);

        emit RentalCompleted(_rentalId);
    }

    /**
     * @dev If the equipment is damaged or not returned, either party can raise a dispute.
     *      This locks the funds until a multi-sig or admin resolves it.
     */
    function raiseDispute(uint256 _rentalId) external {
        RentalAgreement storage rental = rentals[_rentalId];
        require(
            msg.sender == rental.renter || msg.sender == equipments[rental.equipmentId].owner,
            "Only parties involved can dispute"
        );
        require(rental.status == RentalStatus.Active, "Can only dispute active rentals");

        rental.status = RentalStatus.Disputed;

        emit DisputeRaised(_rentalId);
    }

    /**
     * @dev Simplified dispute resolution (admin only for this mock).
     *      In a full system, this would tie into a Multi-Sig DAO.
     */
    function resolveDispute(
        uint256 _rentalId, 
        uint256 _renterRefund, 
        uint256 _ownerPayout
    ) external {
        require(msg.sender == platformTreasury, "Only admin can resolve disputes");
        RentalAgreement storage rental = rentals[_rentalId];
        require(rental.status == RentalStatus.Disputed, "Rental not in dispute");
        
        require(
            _renterRefund + _ownerPayout <= (rental.totalCost + rental.depositHeld), 
            "Payout exceeds held funds"
        );

        rental.status = RentalStatus.Completed;
        equipments[rental.equipmentId].isAvailable = true;

        if (_renterRefund > 0) {
            rental.renter.transfer(_renterRefund);
        }
        if (_ownerPayout > 0) {
            equipments[rental.equipmentId].owner.transfer(_ownerPayout);
        }
    }
}
